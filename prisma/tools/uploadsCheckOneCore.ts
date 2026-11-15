/**
 * 單一上傳檔案的「本機／搬移帳本／Cloudinary」三方唯讀比對核心（可注入假的 Cloudinary 做測試）。
 * 只讀：不上傳、不刪除、不移動、不修改任何檔案，不寫帳本與資料庫。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseUploadUrl, type CloudinaryAssetInfo } from "../../lib/storage/cloudinary";
import type { LedgerEntry } from "./uploadsMigrateCore";

export interface RunRecord { run: string; action?: string; verify?: string; error?: string; note?: string; sha256?: string; size?: number }
export interface CheckOneInput {
  url: string;
  uploadsDir: string;
  ledger: LedgerEntry[];
  runRecords?: RunRecord[];
  auditRecord?: { sha256?: string | null; size?: number; publicId?: string | null; batch?: number; status?: string } | null;
  inspect(url: string): Promise<CloudinaryAssetInfo | null>;
  /** 把雲端檔案下載到暫存檔、串流計算 SHA-256 與大小，完成後必須自行刪除暫存檔。 */
  download(info: CloudinaryAssetInfo): Promise<{ sha256: string; bytes: number }>;
}
export interface CheckOneResult {
  url: string;
  publicIdExpected: string | null;
  local: { path: string; exists: boolean; size?: number; sha256?: string };
  audit: CheckOneInput["auditRecord"] | null;
  ledger: { events: { ts: string; runId: string; event: string; error?: string }[]; verified: boolean; verifiedTotal: number; urlsWithoutVerified: string[] };
  runRecords: RunRecord[];
  cloud: { exists: boolean; publicId?: string; bytes?: number; format?: string; version?: number };
  compare: { localVsAuditSame: boolean | null; cloudSizeSame: boolean | null; downloaded?: { sha256: string; bytes: number }; hashSame: boolean | null; downloadError?: string };
  conclusions: string[];
  needsUpload: boolean;
  needsLedgerRepair: boolean;
}

export const sha256Stream = (file: string) => new Promise<string>((resolve, reject) => {
  const h = crypto.createHash("sha256"); const s = fs.createReadStream(file);
  s.on("data", (c) => h.update(c)); s.on("error", reject); s.on("end", () => resolve(h.digest("hex")));
});

export async function checkOne(inp: CheckOneInput): Promise<CheckOneResult> {
  const parsed = parseUploadUrl(inp.url);
  if (!parsed) throw new Error("這個網址不符合網站讀取規則（不是合法的 /uploads/ 圖片或動畫路徑）。");
  const rel = `${parsed.subdir}/${parsed.filename}`;
  const abs = path.join(inp.uploadsDir, ...rel.split("/"));
  const conclusions: string[] = [];

  // 1–2 本機
  const local: CheckOneResult["local"] = { path: abs, exists: false };
  try { const st = fs.statSync(abs); if (st.isFile()) { local.exists = true; local.size = st.size; local.sha256 = await sha256Stream(abs); } } catch { /* 不存在 */ }

  // 3 帳本
  const mine = inp.ledger.filter((e) => e.url === inp.url);
  const verifiedUrls = new Set(inp.ledger.filter((e) => e.event === "verified").map((e) => e.url));
  const allUrls = new Set(inp.ledger.map((e) => e.url));
  const ledger = {
    events: mine.map((e) => ({ ts: e.ts, runId: e.runId, event: e.event, error: e.error })),
    verified: verifiedUrls.has(inp.url), verifiedTotal: verifiedUrls.size,
    urlsWithoutVerified: [...allUrls].filter((u) => !verifiedUrls.has(u)),
  };

  // 4 Cloudinary（唯讀）
  const info = await inp.inspect(inp.url);
  const cloud: CheckOneResult["cloud"] = info ? { exists: true, publicId: info.publicId, bytes: info.bytes, format: info.format, version: info.version } : { exists: false };
  const cloudSizeSame = info && local.exists && typeof info.bytes === "number" ? info.bytes === local.size : null;

  // 5 下載比對
  const compare: CheckOneResult["compare"] = { localVsAuditSame: null, cloudSizeSame, hashSame: null };
  if (inp.auditRecord?.sha256 && local.sha256) compare.localVsAuditSame = inp.auditRecord.sha256 === local.sha256 && (inp.auditRecord.size === undefined || inp.auditRecord.size === local.size);
  if (info) {
    try { compare.downloaded = await inp.download(info); compare.hashSame = local.sha256 ? compare.downloaded.sha256 === local.sha256 && compare.downloaded.bytes === local.size : null; }
    catch (e) { compare.downloadError = String((e as Error).message).slice(0, 200); }
  }

  // 結論
  let needsUpload = false, needsLedgerRepair = false;
  if (!local.exists) conclusions.push("本機找不到這個檔案：沒有可以上傳的來源。");
  else if (compare.localVsAuditSame === false) conclusions.push("本機檔案的大小或 SHA-256 與掃描報告不同：掃描之後被修改過，上傳前必須先確認哪一份才是正確的。");
  if (!ledger.events.length) conclusions.push("搬移帳本完全沒有這個檔案的紀錄（可能搬移被中途停止，或這個檔案不在當時的清單內）。");
  else if (!ledger.verified) conclusions.push(`搬移帳本有紀錄（${[...new Set(ledger.events.map((e) => e.event))].join("、")}），但沒有 verified：上傳後的驗證步驟沒有成功完成。`);
  if (!cloud.exists) { conclusions.push("Cloudinary 上沒有這個 public_id。"); needsUpload = local.exists && compare.localVsAuditSame !== false; }
  else {
    if (cloudSizeSame === false) conclusions.push(`Cloudinary 的大小（${cloud.bytes}）與本機（${local.size}）不同。`);
    if (compare.downloadError) conclusions.push("下載驗證失敗：" + compare.downloadError);
    else if (compare.hashSame === true) { conclusions.push("下載回來的 SHA-256 與大小和本機完全相同：雲端內容正確。"); needsLedgerRepair = !ledger.verified; }
    else if (compare.hashSame === false) conclusions.push("下載回來的內容與本機不一致：雲端已有同名檔案但內容不同。為了不覆蓋，不建議重新上傳，請先人工確認。");
  }
  return { url: inp.url, publicIdExpected: inp.auditRecord?.publicId ?? null, local, audit: inp.auditRecord ?? null, ledger, runRecords: inp.runRecords ?? [], cloud, compare, conclusions, needsUpload, needsLedgerRepair };
}

export function renderCheckOne(r: CheckOneResult): string {
  const L: string[] = [];
  const mb = (n?: number) => (n === undefined ? "—" : `${n} bytes（${(n / 1024 / 1024).toFixed(2)} MB）`);
  L.push(`# 單一檔案三方檢查（唯讀）`, ``, `檔案：${r.url}`, ``);
  L.push(`## 1–2. 本機`, `- 路徑：${r.local.path}`, `- 存在：${r.local.exists ? "是" : "否"}`);
  if (r.local.exists) L.push(`- 大小：${mb(r.local.size)}`, `- SHA-256：${r.local.sha256}`);
  if (r.audit) L.push(`- 掃描報告：batch=${r.audit.batch}、${r.audit.status}、大小 ${mb(r.audit.size)}、SHA-256 ${r.audit.sha256 ?? "—"}、預計 public_id ${r.audit.publicId ?? "—"}；與本機${r.compare.localVsAuditSame === null ? "（無法比對）" : r.compare.localVsAuditSame ? "相同" : "【不同】"}`);
  L.push(``, `## 3. 搬移帳本`, `- 帳本中 verified 的檔案總數：${r.ledger.verifiedTotal}；這個檔案有 verified：${r.ledger.verified ? "是" : "否"}`);
  if (!r.ledger.events.length) L.push(`- 這個檔案沒有任何帳本紀錄。`); else for (const e of r.ledger.events) L.push(`- ${e.ts}｜${e.runId}｜${e.event}${e.error ? `｜${e.error}` : ""}`);
  if (r.runRecords.length) { L.push(`- 各次執行結果（run-*\\result.json）：`); for (const x of r.runRecords) L.push(`  - ${x.run}：${x.action ?? "—"}／${x.verify ?? "—"}${x.error ? `｜${x.error}` : ""}${x.note ? `｜${x.note}` : ""}`); }
  if (r.ledger.urlsWithoutVerified.length) L.push(`- 帳本中「有紀錄但沒有 verified」的所有檔案（${r.ledger.urlsWithoutVerified.length} 個）：`, ...r.ledger.urlsWithoutVerified.map((u) => `  - ${u}`));
  L.push(``, `## 4. Cloudinary（唯讀查詢）`, `- public_id 存在：${r.cloud.exists ? "是" : "否"}${r.cloud.publicId ? `（${r.cloud.publicId}）` : ""}`);
  if (r.cloud.exists) L.push(`- 大小：${mb(r.cloud.bytes)}；格式：${r.cloud.format ?? "—"}；版本：${r.cloud.version ?? "—"}`, `- 大小與本機相同：${r.compare.cloudSizeSame === null ? "無法比對" : r.compare.cloudSizeSame ? "是" : "否"}`);
  L.push(``, `## 5. 下載比對（暫存檔已清除）`);
  if (r.compare.downloadError) L.push(`- 下載失敗：${r.compare.downloadError}`);
  else if (r.compare.downloaded) L.push(`- 下載大小：${mb(r.compare.downloaded.bytes)}`, `- 下載後 SHA-256：${r.compare.downloaded.sha256}`, `- 與本機相同：${r.compare.hashSame === null ? "無法比對" : r.compare.hashSame ? "是" : "否"}`);
  else L.push(`- 未下載（Cloudinary 上不存在）。`);
  L.push(``, `## 結論`, ...r.conclusions.map((c) => `- ${c}`), `- 是否需要補做上傳：**${r.needsUpload ? "需要" : "不需要"}**`, `- 是否需要修復帳本的驗證紀錄：**${r.needsLedgerRepair ? "需要（雲端內容已確認正確，只缺 verified 紀錄）" : "不需要"}**`);
  return L.join("\n") + "\n";
}
