/**
 * 第一批圖片遷移（本機 uploads → Cloudinary）的核心邏輯，可用假的儲存端獨立測試。
 *
 * 原則
 *  - 清單完全來自掃描報告（files.json）中 batch=1 的紀錄：路徑、public_id、SHA-256 都用報告裡的值，不重新推測。
 *    （只做「一致性檢查」：報告的 public_id 必須等於目前程式會用的 public_id，否則停止，因為前台之後找不到圖。）
 *  - 上傳前用 Admin API 再確認一次 public_id 是否已存在；已存在一律略過，絕不覆蓋（驅動本身也有 overwrite:false 與 existing 檢查）。
 *  - 每一步寫入「帳本」（JSONL，只增不改）：中斷後重跑，已完成的不重複上傳。
 *  - 上傳後下載回來比對 SHA-256 與大小。
 *  - 只讀本機檔案；不寫資料庫、不改圖片網址、不刪除或移動任何檔案；不刪除 Cloudinary 上的任何東西。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseUploadUrl, publicIdFor, normalizeFolder, type CloudinaryAssetInfo } from "../../lib/storage/cloudinary";
import { toCsv } from "./uploadsAuditCore";

export interface MigrateStorage {
  inspect(url: string): Promise<CloudinaryAssetInfo | null>;
  put(subdir: string, filename: string, data: Buffer): Promise<string>;
  read(url: string): Promise<Buffer | null>;
}
export interface PlanItem { url: string; rel: string; publicId: string; sha256: string; size: number; resourceType: "image" | "video" }
export interface Plan {
  folder: string;
  reportGeneratedAt: string;
  items: PlanItem[];
  errors: { url: string; problem: string }[];
  batch1Total: number;
  excluded: { batch2: number; batch2Files: string[]; batch0: number };
}
export const sha256Of = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

/** 讀掃描報告並建立清單。任何一筆和本機檔案對不上（被改過、不見了）都列入 errors，正式上傳會因此拒絕執行。 */
export function loadPlan(report: any, opt: { folder: string; uploadsDir: string; expectCount?: number; limit?: number; readLocal?: (abs: string) => Buffer }): Plan {
  if (!report || !Array.isArray(report.records)) throw new Error("掃描報告格式不正確（找不到 records）。請用 npm run audit:uploads 產生的 files.json。");
  const folder = normalizeFolder(opt.folder);
  if (normalizeFolder(report.folder) !== folder) throw new Error(`報告的 Cloudinary 資料夾（${report.folder}）與目前設定（${folder}）不同。請用相同的 CLOUDINARY_FOLDER 重新掃描，或把環境變數改成與報告一致。`);
  const readLocal = opt.readLocal ?? ((abs: string) => fs.readFileSync(abs));
  const batch1 = (report.records as any[]).filter((r) => r.batch === 1).sort((a, b) => String(a.rel).localeCompare(String(b.rel)));
  const batch2 = (report.records as any[]).filter((r) => r.batch === 2);
  const batch0 = (report.records as any[]).filter((r) => r.batch === 0);
  if (opt.expectCount !== undefined && batch1.length !== opt.expectCount) throw new Error(`報告中 batch=1 的檔案是 ${batch1.length} 個，與 --expect-count ${opt.expectCount} 不同，已停止。`);

  const root = path.resolve(opt.uploadsDir);
  const items: PlanItem[] = [];
  const errors: Plan["errors"] = [];
  for (const r of batch1) {
    const bad = (problem: string) => errors.push({ url: String(r.url), problem });
    if (r.status !== "used") { bad("報告中這筆不是『使用中』"); continue; }
    if (!r.sha256) { bad("報告沒有 SHA-256（掃描時用了 --no-hash）。請重新掃描，不要加 --no-hash。"); continue; }
    if (!r.publicId || !r.resourceType) { bad("報告缺少 public_id"); continue; }
    if (Array.isArray(r.problems) && r.problems.length) { bad("報告標示有問題：" + r.problems.join("；")); continue; }
    const p = parseUploadUrl(r.url);
    if (!p || r.url !== "/uploads/" + r.rel) { bad("網址不符合網站讀取規則，或與報告的相對路徑不一致"); continue; }
    if (publicIdFor(folder, p) !== r.publicId) { bad(`報告的 public_id（${r.publicId}）和目前程式會使用的（${publicIdFor(folder, p)}）不一致，前台之後會找不到。請用目前版本重新掃描。`); continue; }
    const abs = path.resolve(root, ...String(r.rel).split("/"));
    if (!abs.startsWith(root + path.sep)) { bad("路徑超出 uploads 資料夾"); continue; }
    let data: Buffer;
    try { data = readLocal(abs); } catch { bad("本機找不到這個檔案（掃描之後被移動或刪除？）"); continue; }
    if (data.length !== r.size) { bad(`本機檔案大小（${data.length}）與報告（${r.size}）不同，掃描之後被修改過`); continue; }
    if (sha256Of(data) !== r.sha256) { bad("本機檔案內容與報告的 SHA-256 不同，掃描之後被修改過"); continue; }
    items.push({ url: r.url, rel: r.rel, publicId: r.publicId, sha256: r.sha256, size: r.size, resourceType: r.resourceType });
  }
  const limited = opt.limit !== undefined ? items.slice(0, opt.limit) : items;
  return { folder, reportGeneratedAt: String(report.generatedAt ?? ""), items: limited, errors, batch1Total: batch1.length, excluded: { batch2: batch2.length, batch2Files: batch2.map((r) => String(r.url)), batch0: batch0.length } };
}

// ───────────────────────── 帳本（只增不改） ─────────────────────────
export interface LedgerEntry {
  ts: string; runId: string;
  event: "uploaded" | "exists" | "verified" | "verify-failed" | "failed";
  url: string; publicId: string; sha256: string; size: number;
  secureUrl?: string; version?: number; remoteBytes?: number; error?: string;
}
export function readLedger(file: string): LedgerEntry[] {
  if (!fs.existsSync(file)) return [];
  const out: LedgerEntry[] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* 中斷時最後一行可能不完整：忽略 */ }
  }
  return out;
}
export const appendLedger = (file: string, e: LedgerEntry) => fs.appendFileSync(file, JSON.stringify(e) + "\n", "utf8");
const keyOf = (i: { publicId: string; sha256: string }) => `${i.publicId}|${i.sha256}`;

// ───────────────────────── 預演（dry-run） ─────────────────────────
export type DryAction = "將上傳" | "將上傳（尚未檢查雲端）" | "已存在，將略過（不覆蓋）" | "帳本顯示已完成，將略過";
export interface DryRow extends PlanItem { action: DryAction }
export async function runDryRun(plan: Plan, opt: { ledger: LedgerEntry[]; storage?: MigrateStorage }): Promise<{ rows: DryRow[]; toUpload: number; toUploadBytes: number; skipExisting: number; skipLedger: number; unchecked: number }> {
  const done = new Set(opt.ledger.filter((e) => e.event === "verified").map(keyOf));
  const rows: DryRow[] = [];
  for (const it of plan.items) {
    let action: DryAction;
    if (done.has(keyOf(it))) action = "帳本顯示已完成，將略過";
    else if (!opt.storage) action = "將上傳（尚未檢查雲端）";
    else action = (await opt.storage.inspect(it.url)) ? "已存在，將略過（不覆蓋）" : "將上傳";
    rows.push({ ...it, action });
  }
  const up = rows.filter((r) => r.action.startsWith("將上傳"));
  return { rows, toUpload: up.length, toUploadBytes: up.reduce((n, r) => n + r.size, 0), skipExisting: rows.filter((r) => r.action.startsWith("已存在")).length, skipLedger: rows.filter((r) => r.action.startsWith("帳本")).length, unchecked: rows.filter((r) => r.action.includes("尚未檢查")).length };
}

// ───────────────────────── 正式上傳 ─────────────────────────
export type ItemAction = "uploaded" | "skipped-exists" | "skipped-ledger" | "failed" | "not-attempted";
export type VerifyState = "verified" | "hash-mismatch" | "verify-failed" | "not-verified";
export interface ItemResult extends PlanItem {
  action: ItemAction; verify: VerifyState; secureUrl?: string; version?: number; remoteBytes?: number; error?: string; note?: string;
}
export interface ApplyDeps {
  storage: MigrateStorage;
  readLocal(rel: string): Buffer;
  ledger: LedgerEntry[];
  appendLedger(e: LedgerEntry): void;
  runId: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (s: string) => void;
  maxAttempts?: number;
  /** 連續幾筆失敗就停止（避免金鑰錯誤時一直打 API） */
  abortAfterFailures?: number;
}

export async function runApply(plan: Plan, deps: ApplyDeps): Promise<ItemResult[]> {
  if (plan.errors.length) throw new Error("清單有未解決的問題，拒絕上傳：" + plan.errors.map((e) => e.url).join("、"));
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = deps.log ?? (() => {});
  const maxAttempts = deps.maxAttempts ?? 3;
  const abortAfter = deps.abortAfterFailures ?? 3;
  const verified = new Set(deps.ledger.filter((e) => e.event === "verified").map(keyOf));
  const uploadedBefore = new Set(deps.ledger.filter((e) => e.event === "uploaded").map(keyOf));
  const results: ItemResult[] = [];
  let consecutiveFailures = 0;

  const record = (it: PlanItem, event: LedgerEntry["event"], extra: Partial<LedgerEntry> = {}) =>
    deps.appendLedger({ ts: now().toISOString(), runId: deps.runId, event, url: it.url, publicId: it.publicId, sha256: it.sha256, size: it.size, ...extra });
  const retry = async <T,>(f: () => Promise<T>): Promise<T> => {
    let last: unknown;
    for (let a = 1; a <= maxAttempts; a++) {
      try { return await f(); } catch (e) { last = e; if (a < maxAttempts) await sleep(500 * a); }
    }
    throw last;
  };

  for (const [idx, it] of plan.items.entries()) {
    const tag = `[${idx + 1}/${plan.items.length}] ${it.url}`;
    if (consecutiveFailures >= abortAfter) { results.push({ ...it, action: "not-attempted", verify: "not-verified", note: `連續 ${abortAfter} 筆失敗，已停止；修正問題後重跑即可續傳` }); continue; }
    if (verified.has(keyOf(it))) { results.push({ ...it, action: "skipped-ledger", verify: "verified", note: "帳本顯示先前已上傳並驗證" }); log(`${tag} 略過（先前已完成）`); consecutiveFailures = 0; continue; }

    const res: ItemResult = { ...it, action: "failed", verify: "not-verified" };
    try {
      let info = await retry(() => deps.storage.inspect(it.url));
      if (info) {
        res.action = uploadedBefore.has(keyOf(it)) ? "uploaded" : "skipped-exists";
        res.note = res.action === "uploaded" ? "先前已上傳（帳本），這次補做驗證" : "Cloudinary 上已有相同 public_id，未覆蓋";
        if (res.action === "skipped-exists") record(it, "exists", { version: info.version, remoteBytes: info.bytes });
      } else {
        const data = deps.readLocal(it.rel);
        if (data.length !== it.size || sha256Of(data) !== it.sha256) throw new Error("本機檔案在掃描後被修改，已停止上傳這一筆。");
        const p = parseUploadUrl(it.url)!;
        let attempt = 0;
        for (;;) {
          attempt++;
          try { await deps.storage.put(p.subdir, p.filename, data); res.action = "uploaded"; break; }
          catch (e) {
            const msg = String((e as Error).message);
            if (/已存在/.test(msg)) { res.action = attempt > 1 ? "uploaded" : "skipped-exists"; res.note = attempt > 1 ? "重試時發現已存在（應是前一次已成功），以雜湊驗證" : "上傳瞬間發現已存在，未覆蓋"; break; }
            if (attempt >= maxAttempts) throw e;
            await sleep(500 * attempt);
          }
        }
        info = await retry(() => deps.storage.inspect(it.url));
        if (!info) throw new Error("上傳後 Admin API 仍查不到這個檔案。");
        if (res.action === "uploaded") record(it, "uploaded", { secureUrl: info.secureUrl, version: info.version, remoteBytes: info.bytes });
      }
      if (info.publicId !== it.publicId) throw new Error(`Cloudinary 上的 public_id（${info.publicId}）與清單（${it.publicId}）不一致。`);
      res.secureUrl = info.secureUrl; res.version = info.version; res.remoteBytes = info.bytes;

      // 驗證：下載回來比對 SHA-256 與大小
      try {
        const back = await retry(() => deps.storage.read(it.url));
        if (!back) { res.verify = "verify-failed"; res.error = "下載驗證時讀不到檔案"; record(it, "verify-failed", { error: res.error }); }
        else if (back.length === it.size && sha256Of(back) === it.sha256) { res.verify = "verified"; record(it, "verified", { secureUrl: info.secureUrl, version: info.version, remoteBytes: info.bytes }); }
        else {
          res.verify = "hash-mismatch";
          res.error = `雲端內容與本機不一致（雲端 ${back.length} bytes／本機 ${it.size} bytes）。${res.action === "skipped-exists" ? "這是原本就存在的檔案，已保持原樣、沒有覆蓋。" : ""}`;
          record(it, "verify-failed", { error: res.error });
        }
      } catch (e) { res.verify = "verify-failed"; res.error = "下載驗證失敗：" + String((e as Error).message).slice(0, 160); record(it, "verify-failed", { error: res.error }); }
      consecutiveFailures = res.verify === "verified" ? 0 : consecutiveFailures + 1;
    } catch (e) {
      res.action = "failed"; res.error = String((e as Error).message).slice(0, 200);
      record(it, "failed", { error: res.error });
      consecutiveFailures++;
    }
    log(`${tag} → ${res.action}／${res.verify}${res.error ? "：" + res.error : ""}`);
    results.push(res);
  }
  return results;
}

// ───────────────────────── 報表 ─────────────────────────
const mb = (n: number) => (n / 1024 / 1024).toFixed(2) + " MB";
export function dryRunCsv(rows: DryRow[]): string {
  return toCsv([["原始路徑", "預計 public_id", "資源類型", "大小(bytes)", "SHA-256", "動作"], ...rows.map((r) => [r.url, r.publicId, r.resourceType, r.size, r.sha256, r.action])]);
}
export function resultCsv(rs: ItemResult[]): string {
  return toCsv([["原始路徑", "public_id", "SHA-256", "大小(bytes)", "上傳結果", "驗證", "Secure URL", "雲端大小(bytes)", "說明／錯誤"], ...rs.map((r) => [r.url, r.publicId, r.sha256, r.size, r.action, r.verify, r.secureUrl ?? "", r.remoteBytes ?? "", [r.note, r.error].filter(Boolean).join("；")])]);
}
export function summarize(rs: ItemResult[]) {
  const c = (f: (r: ItemResult) => boolean) => rs.filter(f);
  return {
    total: rs.length,
    uploaded: c((r) => r.action === "uploaded").length,
    skippedExists: c((r) => r.action === "skipped-exists").length,
    skippedLedger: c((r) => r.action === "skipped-ledger").length,
    failed: c((r) => r.action === "failed").length,
    notAttempted: c((r) => r.action === "not-attempted").length,
    verified: c((r) => r.verify === "verified").length,
    mismatch: c((r) => r.verify === "hash-mismatch").length,
    verifyFailed: c((r) => r.verify === "verify-failed").length,
    uploadedBytes: c((r) => r.action === "uploaded").reduce((n, r) => n + r.size, 0),
  };
}
export function planSummaryMd(plan: Plan, dry: Awaited<ReturnType<typeof runDryRun>>, ctx: { reportPath: string; checkedRemote: boolean }): string {
  const L: string[] = [];
  L.push("# 第一批遷移 預演（dry-run）報告", "", "這是預演：沒有上傳任何檔案、沒有修改資料庫與本機檔案" + (ctx.checkedRemote ? "（只對 Cloudinary 做了唯讀的存在檢查）。" : "，也沒有連線 Cloudinary。"), "");
  L.push(`- 依據的掃描報告：${ctx.reportPath}（產生於 ${plan.reportGeneratedAt}）`, `- Cloudinary 資料夾：${plan.folder}`);
  L.push(`- 報告中 batch=1（使用中）：${plan.batch1Total} 個；本次清單：${plan.items.length} 個`);
  L.push(`- 預計上傳：**${dry.toUpload} 個，${mb(dry.toUploadBytes)}**`);
  L.push(`- 已存在、將略過：${dry.skipExisting} 個；帳本顯示已完成、將略過：${dry.skipLedger} 個` + (dry.unchecked ? `；尚未檢查雲端：${dry.unchecked} 個（加 --check-remote 可唯讀確認）` : ""));
  L.push(`- 不會處理：batch=2 歷史圖片 ${plan.excluded.batch2} 個、batch=0 不可遷移 ${plan.excluded.batch0} 個`);
  if (plan.excluded.batch2Files.length) { L.push("", "不會上傳的歷史圖片（完整保留在本機）："); for (const f of plan.excluded.batch2Files) L.push(`- ${f}`); }
  L.push("", "## 清單與本機檔案的一致性檢查", plan.errors.length ? "" : "全部通過：每個檔案的大小與 SHA-256 都和掃描報告相同。");
  for (const e of plan.errors) L.push(`- ❌ ${e.url}：${e.problem}`);
  L.push("", "逐檔清單見 dry-run.csv。");
  return L.join("\n") + "\n";
}
export function resultSummaryMd(plan: Plan, rs: ItemResult[], ctx: { reportPath: string; runId: string }): string {
  const s = summarize(rs);
  const L = ["# 第一批遷移 執行結果", "", `- 執行編號：${ctx.runId}`, `- 依據的掃描報告：${ctx.reportPath}`, `- Cloudinary 資料夾：${plan.folder}`, ""];
  L.push(`- 清單：${s.total} 個`, `- 本次新上傳：${s.uploaded} 個（${mb(s.uploadedBytes)}）`, `- 已存在而略過（未覆蓋）：${s.skippedExists} 個`, `- 帳本顯示先前已完成：${s.skippedLedger} 個`, `- 上傳失敗：${s.failed} 個；未執行（連續失敗而停止）：${s.notAttempted} 個`);
  L.push(`- 驗證通過（下載後 SHA-256 與大小一致）：${s.verified} 個；內容不一致：${s.mismatch} 個；驗證失敗：${s.verifyFailed} 個`, "");
  const bad = rs.filter((r) => r.action === "failed" || r.action === "not-attempted" || r.verify !== "verified");
  L.push(bad.length ? "## 需要處理的項目" : "## 全部成功", "");
  for (const r of bad) L.push(`- ${r.url}：${r.action}／${r.verify}${r.error ? " — " + r.error : ""}${r.note ? " — " + r.note : ""}`);
  L.push("", "沒有修改資料庫、沒有修改圖片網址、沒有刪除或移動任何本機檔案，也沒有刪除 Cloudinary 上的任何檔案。", "逐檔結果見 result.csv；續傳帳本為 ledger.jsonl。");
  return L.join("\n") + "\n";
}
