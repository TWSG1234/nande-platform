/**
 * 上傳圖片「遷移前掃描」的核心（純函式＋唯讀檔案／資料庫查詢，可獨立測試）。
 * 絕對唯讀：只讀檔案內容（大小、前幾個 byte、SHA-256）、只執行 SELECT／PRAGMA table_info。
 * 不上傳、不連 Cloudinary、不寫資料庫、不刪除／移動／改名任何檔案。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseUploadUrl, publicIdFor, resourceTypeFor } from "../../lib/storage/cloudinary";

export interface Limits {
  maxImageBytes: number;
  maxVideoBytes: number;
}
/** Cloudinary 免費方案的常見上限（圖片 10MB、影片 100MB）。實際以帳號方案為準，可用參數調整。 */
export const DEFAULT_LIMITS: Limits = { maxImageBytes: 10 * 1024 * 1024, maxVideoBytes: 100 * 1024 * 1024 };

export interface FileEntry {
  /** 相對 uploads 的路徑，一律用 / */
  rel: string;
  size: number;
  mtimeMs: number;
  /** 前幾個 byte 判斷的內容格式是否和副檔名相符（讀不到為 null） */
  magicOk: boolean | null;
  sha256: string | null;
  symlinkOutside: boolean;
}
export interface InternalSummary {
  dir: string;
  files: number;
  bytes: number;
}
export interface DbRef {
  url: string;
  table: string;
  column: string;
  rowId: string;
}

// ───────────────────────── 檔案掃描 ─────────────────────────
export function magicMatches(ext: string, head: Buffer): boolean | null {
  if (head.length === 0) return false;
  switch (ext) {
    case ".png": return head.subarray(0, 4).toString("hex") === "89504e47";
    case ".jpg":
    case ".jpeg": return head.subarray(0, 3).toString("hex") === "ffd8ff";
    case ".gif": return head.subarray(0, 4).toString("latin1") === "GIF8";
    case ".webp": return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
    case ".mp4": return head.subarray(4, 8).toString("latin1") === "ftyp";
    case ".svg": return /<svg[\s>]/i.test(head.toString("utf8"));
    default: return null;
  }
}

export interface WalkOptions {
  hash?: boolean;
}
/** 遞迴列出 uploads 底下所有檔案。以 . 或 _ 開頭的最上層資料夾（_trash 回收區）只統計、不列入遷移。 */
export function walkUploads(root: string, opt: WalkOptions = {}): { files: FileEntry[]; internal: InternalSummary[] } {
  const files: FileEntry[] = [];
  const internal: InternalSummary[] = [];
  const realRoot = fs.realpathSync(root);

  const countAll = (dir: string): { files: number; bytes: number } => {
    let n = 0, b = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { const r = countAll(p); n += r.files; b += r.bytes; }
      else if (e.isFile()) { n++; b += fs.statSync(p).size; }
    }
    return { files: n, bytes: b };
  };

  const walk = (dir: string, relParts: string[]) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      const parts = [...relParts, e.name];
      if (e.isDirectory() || (e.isSymbolicLink() && fs.statSync(abs).isDirectory())) {
        if (relParts.length === 0 && (e.name.startsWith(".") || e.name.startsWith("_"))) { internal.push({ dir: e.name, ...countAll(abs) }); continue; }
        walk(abs, parts);
        continue;
      }
      if (e.name === ".gitkeep") continue;
      let st: fs.Stats;
      try { st = fs.statSync(abs); } catch { continue; }
      if (!st.isFile()) continue;
      let symlinkOutside = false;
      try { symlinkOutside = !fs.realpathSync(abs).startsWith(realRoot + path.sep); } catch { symlinkOutside = true; }
      const ext = path.extname(e.name).toLowerCase();
      let magicOk: boolean | null = null, sha256: string | null = null;
      try {
        const fd = fs.openSync(abs, "r");
        const head = Buffer.alloc(512);
        const n = fs.readSync(fd, head, 0, 512, 0);
        fs.closeSync(fd);
        magicOk = magicMatches(ext, head.subarray(0, n));
        if (opt.hash !== false) sha256 = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
      } catch { /* 讀不到：magicOk/sha256 維持 null，報告會標示 */ }
      files.push({ rel: parts.join("/"), size: st.size, mtimeMs: st.mtimeMs, magicOk, sha256, symlinkOutside });
    }
  };
  walk(root, []);
  return { files, internal };
}

// ───────────────────────── 資料庫引用 ─────────────────────────
/** 從一個欄位值取出所有 /uploads/… 網址（支援單純網址、JSON 陣列／物件、以及夾在內文裡的連結）。 */
export function extractUploadUrls(value: string): string[] {
  const out = new Set<string>();
  const add = (u: string) => {
    const clean = u.split(/[?#]/)[0]!.replace(/[.,;:!)\]}]+$/, "");
    if (clean.startsWith("/uploads/") && clean.length > "/uploads/".length) out.add(clean);
  };
  const t = value.trim();
  if (t.startsWith("/uploads/") && !/[\r\n]/.test(t)) add(t);
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const walk = (v: unknown) => {
        if (typeof v === "string") { for (const u of extractUploadUrls(v)) out.add(u); }
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") Object.values(v as object).forEach(walk);
      };
      walk(JSON.parse(t));
    } catch { /* 不是 JSON：交給下面的文字掃描 */ }
  }
  for (const m of value.matchAll(/\/uploads\/[^\s"'<>\\`|，。、；：！？「」『』【】《》〈〉“”‘’]+/g)) add(m[0]);
  return [...out];
}

export type Query = (sql: string) => Promise<Record<string, unknown>[]>;
const SKIP_TABLES = /^(sqlite_|_prisma)/i;
const SKIP_TABLE_NAMES = new Set(["Admin"]);
const SKIP_COLUMNS = /password|secret|token|hash/i;

/** 掃描資料庫中「所有文字欄位」裡的 /uploads/… 網址。只執行 SELECT／PRAGMA。 */
export async function collectDbRefs(rawQuery: Query): Promise<{ refs: DbRef[]; tablesScanned: string[]; tablesSkipped: string[]; driveRows: { table: string; column: string; count: number }[] }> {
  const query: Query = async (sql) => {
    if (!/^\s*(SELECT|PRAGMA table_info)\b/i.test(sql)) throw new Error("掃描工具只允許 SELECT／PRAGMA table_info：" + sql.slice(0, 40));
    return rawQuery(sql);
  };
  const refs: DbRef[] = [];
  const tablesScanned: string[] = [], tablesSkipped: string[] = [];
  const driveCounts = new Map<string, number>();
  const tables = (await query(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)).map((r) => String(r.name));
  for (const table of tables) {
    if (SKIP_TABLES.test(table) || SKIP_TABLE_NAMES.has(table)) { tablesSkipped.push(table); continue; }
    const cols = await query(`PRAGMA table_info("${table.replace(/"/g, '""')}")`);
    const names = cols.map((c) => String(c.name));
    const textCols = cols.filter((c) => /^(TEXT|VARCHAR|CHAR|CLOB|)/i.test(String(c.type ?? "")) && !SKIP_COLUMNS.test(String(c.name))).map((c) => String(c.name));
    if (!textCols.length) continue;
    const idCol = names.includes("id") ? `"id"` : `rowid AS "id"`;
    const rows = await query(`SELECT ${idCol}, ${textCols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ")} FROM "${table.replace(/"/g, '""')}"`);
    tablesScanned.push(table);
    for (const row of rows) {
      for (const col of textCols) {
        const v = row[col];
        if (typeof v !== "string" || !v) continue;
        if (v.includes("drive.google.com")) driveCounts.set(`${table}.${col}`, (driveCounts.get(`${table}.${col}`) ?? 0) + 1);
        if (!v.includes("/uploads/")) continue;
        for (const url of extractUploadUrls(v)) refs.push({ url, table, column: col, rowId: String(row.id ?? "") });
      }
    }
  }
  const driveRows = [...driveCounts].map(([k, count]) => { const [table, column] = k.split("."); return { table: table!, column: column!, count }; });
  return { refs, tablesScanned, tablesSkipped, driveRows };
}

// ───────────────────────── 分析與報告 ─────────────────────────
export interface FileRecord {
  rel: string;
  url: string;
  size: number;
  sha256: string | null;
  status: "used" | "unreferenced";
  refCount: number;
  refs: string[];
  publicId: string | null;
  resourceType: "image" | "video" | null;
  hashedName: boolean;
  /** 1＝第一批（使用中且可遷移）；2＝歷史／未引用且可遷移（暫不搬）；0＝不可直接遷移 */
  batch: 0 | 1 | 2;
  problems: string[];
  notes: string[];
}
export interface MissingRef { url: string; refs: string[]; reason: string; caseMatch: string | null; seedHas: boolean }
export interface AuditReport {
  generatedAt: string;
  folder: string;
  totals: { files: number; bytes: number };
  byFolder: { folder: string; files: number; bytes: number }[];
  used: { files: number; bytes: number };
  unreferenced: { files: number; bytes: number };
  batch1: { files: number; bytes: number };
  notMigratable: { files: number; bytes: number };
  records: FileRecord[];
  missing: MissingRef[];
  internal: InternalSummary[];
  conflicts: { publicId: string; files: string[] }[];
  driveRows: { table: string; column: string; count: number }[];
  tablesScanned: string[];
  tablesSkipped: string[];
  limits: Limits;
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(2) + " MB";
export { mb as formatMB };

/** 為什麼 parseUploadUrl 不接受這個檔案（給報告用的中文原因）。 */
export function unmigratableReason(rel: string): string {
  const segs = rel.split("/");
  const name = segs[segs.length - 1]!;
  const ext = path.extname(name).toLowerCase();
  if (segs.length < 2) return "放在 uploads 最上層（網站只提供 /uploads/<子資料夾>/<檔名>）";
  if (segs.length > 6) return "資料夾層數超過 5 層";
  if (segs.some((s) => !s || s === "." || s === ".." || /[\0\\:*?"<>|]/.test(s))) return "路徑含不允許的字元（\\ : * ? \" < > |）";
  if (!ext) return "沒有副檔名";
  const anim = segs.length === 2 && segs[0] === "chinese-animation" && [".mp4", ".gif", ".svg"].includes(ext);
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) && !anim) return `副檔名 ${ext} 網站不提供（只提供 png/jpg/jpeg/webp/gif；mp4/svg 只限 chinese-animation 第一層）`;
  return "不符合網站讀取規則";
}

export function buildAudit(input: {
  files: FileEntry[];
  internal: InternalSummary[];
  refs: DbRef[];
  folder: string;
  limits?: Limits;
  seedRels?: Set<string>;
  driveRows?: AuditReport["driveRows"];
  tablesScanned?: string[];
  tablesSkipped?: string[];
  now?: Date;
}): AuditReport {
  const limits = input.limits ?? DEFAULT_LIMITS;
  const byRel = new Map(input.files.map((f) => [f.rel, f]));
  const byLower = new Map<string, FileEntry>();
  for (const f of input.files) if (!byLower.has(f.rel.toLowerCase())) byLower.set(f.rel.toLowerCase(), f);

  // 資料庫引用 → 檔案
  const refsByFile = new Map<string, string[]>();
  const missingMap = new Map<string, { refs: string[] }>();
  const decode = (u: string) => { try { return decodeURIComponent(u.slice("/uploads/".length)); } catch { return u.slice("/uploads/".length); } };
  for (const r of input.refs) {
    const key = decode(r.url);
    const label = `${r.table}.${r.column}#${r.rowId}`;
    if (byRel.has(key)) { const a = refsByFile.get(key) ?? []; a.push(label); refsByFile.set(key, a); }
    else { const m = missingMap.get(r.url) ?? { refs: [] }; m.refs.push(label); missingMap.set(r.url, m); }
  }

  const records: FileRecord[] = [];
  for (const f of input.files) {
    const url = "/uploads/" + f.rel;
    const parsed = parseUploadUrl(url);
    const refs = refsByFile.get(f.rel) ?? [];
    const problems: string[] = [];
    const notes: string[] = [];
    if (!parsed) problems.push("不可直接遷移：" + unmigratableReason(f.rel));
    if (f.symlinkOutside) problems.push("符號連結指向 uploads 以外（網站也不會提供）");
    if (f.size === 0) problems.push("檔案大小為 0");
    if (f.magicOk === false) problems.push("檔案內容和副檔名不符（Cloudinary 會拒絕）");
    if (f.magicOk === null && parsed && f.sha256 === null) problems.push("讀取檔案失敗（權限或被鎖定）");
    if (parsed) {
      const isVideo = resourceTypeFor(parsed.ext) === "video";
      const max = isVideo ? limits.maxVideoBytes : limits.maxImageBytes;
      if (f.size > max) problems.push(`超過大小限制：${mb(f.size)} > ${mb(max)}`);
      if (parsed.hashed) notes.push("檔名或資料夾含中文／空白／特殊符號 → public_id 使用固定雜湊（網址與資料庫不用改）");
    }
    const migratable = problems.length === 0 && !!parsed;
    records.push({
      rel: f.rel, url, size: f.size, sha256: f.sha256,
      status: refs.length ? "used" : "unreferenced", refCount: refs.length, refs: refs.slice(0, 5),
      publicId: parsed ? publicIdFor(input.folder, parsed) : null,
      resourceType: parsed ? resourceTypeFor(parsed.ext) : null,
      hashedName: !!parsed?.hashed,
      batch: !migratable ? 0 : refs.length ? 1 : 2,
      problems, notes,
    });
  }

  // public_id 衝突：不同檔案算出同一個 public_id（只會發生在極少數情況，例如同 UUID 不同副檔名）
  const byId = new Map<string, FileRecord[]>();
  for (const r of records) if (r.publicId) byId.set(r.publicId, [...(byId.get(r.publicId) ?? []), r]);
  const conflicts: AuditReport["conflicts"] = [];
  for (const [publicId, rs] of byId) {
    if (rs.length < 2) continue;
    conflicts.push({ publicId, files: rs.map((r) => r.rel) });
    for (const r of rs) { r.problems.push(`public_id 衝突：與 ${rs.filter((x) => x !== r).map((x) => x.rel).join("、")} 相同`); r.batch = 0; }
  }

  const missing: MissingRef[] = [...missingMap].map(([url, m]) => {
    const key = decode(url);
    const ci = byLower.get(key.toLowerCase());
    const parsed = parseUploadUrl(url);
    return {
      url, refs: m.refs.slice(0, 5),
      reason: ci ? "檔名大小寫不一致（Windows 讀得到，Cloudinary 區分大小寫）" : !parsed ? "網址本身不符合網站讀取規則" : "uploads 裡找不到這個檔案",
      caseMatch: ci ? ci.rel : null,
      seedHas: !!input.seedRels?.has(key),
    };
  });

  const sum = (rs: FileRecord[]) => ({ files: rs.length, bytes: rs.reduce((n, r) => n + r.size, 0) });
  const folderMap = new Map<string, { files: number; bytes: number }>();
  for (const r of records) {
    const segs = r.rel.split("/"); const k = segs.length > 1 ? segs.slice(0, Math.min(segs.length - 1, 2)).join("/") : "(最上層)";
    const cur = folderMap.get(k) ?? { files: 0, bytes: 0 }; cur.files++; cur.bytes += r.size; folderMap.set(k, cur);
  }
  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    folder: input.folder,
    totals: sum(records),
    byFolder: [...folderMap].map(([folder, v]) => ({ folder, ...v })).sort((a, b) => a.folder.localeCompare(b.folder)),
    used: sum(records.filter((r) => r.status === "used")),
    unreferenced: sum(records.filter((r) => r.status === "unreferenced")),
    batch1: sum(records.filter((r) => r.batch === 1)),
    notMigratable: sum(records.filter((r) => r.batch === 0)),
    records, missing, internal: input.internal, conflicts,
    driveRows: input.driveRows ?? [], tablesScanned: input.tablesScanned ?? [], tablesSkipped: input.tablesSkipped ?? [], limits,
  };
}

// ───────────────────────── 輸出格式 ─────────────────────────
const csvCell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"; // BOM：Excel 開啟中文不亂碼
}
export function filesCsv(rep: AuditReport): string {
  const head = ["原始路徑(/uploads/…)", "大小(bytes)", "狀態", "批次(1=第一批使用中 2=歷史未搬 0=不可直接遷移)", "預計 public_id", "資源類型", "被引用次數", "引用位置(最多5筆)", "問題", "備註", "SHA-256"];
  return toCsv([head, ...rep.records.map((r) => [r.url, r.size, r.status === "used" ? "使用中" : "未被引用", r.batch, r.publicId, r.resourceType, r.refCount, r.refs.join(" | "), r.problems.join("；"), r.notes.join("；"), r.sha256])]);
}
export function missingCsv(rep: AuditReport): string {
  return toCsv([["資料庫引用的網址", "引用位置(最多5筆)", "原因", "大小寫相符的實際檔案", "內建原檔(prisma/assets/uploads)有同名檔"], ...rep.missing.map((m) => [m.url, m.refs.join(" | "), m.reason, m.caseMatch ?? "", m.seedHas ? "有" : "沒有"])]);
}

export function summaryMarkdown(rep: AuditReport): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  p("# uploads 遷移前掃描報告（唯讀）");
  p(`產生時間：${rep.generatedAt}　Cloudinary 資料夾（CLOUDINARY_FOLDER）：${rep.folder}`);
  p(`大小上限（可用參數調整）：圖片 ${mb(rep.limits.maxImageBytes)}、影片 ${mb(rep.limits.maxVideoBytes)}`);
  p();
  p("## 一、總覽");
  p(`- uploads 內可列入遷移評估的檔案：**${rep.totals.files}** 個，共 **${mb(rep.totals.bytes)}**`);
  p(`- 目前網站使用中（資料庫有引用）：${rep.used.files} 個，${mb(rep.used.bytes)}`);
  p(`- 歷史／未被引用：${rep.unreferenced.files} 個，${mb(rep.unreferenced.bytes)}`);
  p(`- **第一批預計遷移（使用中且可直接遷移）：${rep.batch1.files} 個，${mb(rep.batch1.bytes)}**`);
  p(`- 不可直接遷移：${rep.notMigratable.files} 個，${mb(rep.notMigratable.bytes)}`);
  p(`- 資料庫引用但 uploads 找不到：${rep.missing.length} 個網址`);
  p(`- public_id 衝突：${rep.conflicts.length} 組`);
  p();
  p("## 二、資料夾分布");
  p("| 資料夾 | 檔案數 | 容量 |"); p("|---|---:|---:|");
  for (const f of rep.byFolder) p(`| ${f.folder} | ${f.files} | ${mb(f.bytes)} |`);
  if (rep.internal.length) { p(); p("內部資料夾（回收區等，不遷移、完整保留）："); for (const i of rep.internal) p(`- ${i.dir}：${i.files} 個，${mb(i.bytes)}`); }
  p();
  p("## 三、不可直接遷移／有問題的檔案");
  const bad = rep.records.filter((r) => r.problems.length);
  if (!bad.length) p("無。"); else { p("| 檔案 | 使用中 | 問題 |"); p("|---|---|---|"); for (const r of bad) p(`| ${r.url} | ${r.status === "used" ? "是" : "否"} | ${r.problems.join("；")} |`); }
  p();
  p("## 四、資料庫有引用但 uploads 找不到");
  if (!rep.missing.length) p("無。"); else { p("| 網址 | 引用位置 | 原因 | 內建原檔有同名 |"); p("|---|---|---|---|"); for (const m of rep.missing) p(`| ${m.url} | ${m.refs.join("、")} | ${m.reason} | ${m.seedHas ? "有" : "沒有"} |`); }
  p();
  p("## 五、檔名需轉成雜湊 public_id 的檔案（網址／資料庫不用改）");
  const hashed = rep.records.filter((r) => r.hashedName);
  if (!hashed.length) p("無。"); else for (const r of hashed) p(`- ${r.url} → ${r.publicId}`);
  p();
  p("## 六、public_id 衝突");
  if (!rep.conflicts.length) p("無。"); else for (const c of rep.conflicts) p(`- ${c.publicId}：${c.files.join("、")}`);
  p();
  p("## 七、Google Drive 學生投稿");
  if (!rep.driveRows.length) p("資料庫中沒有指向 drive.google.com 的欄位。"); else for (const d of rep.driveRows) p(`- ${d.table}.${d.column}：${d.count} 筆指向 Google Drive（不是本機檔，不遷移、不受影響）`);
  p();
  p("## 八、掃描範圍");
  p(`已掃描資料表：${rep.tablesScanned.join("、") || "（無）"}`);
  p(`略過：${rep.tablesSkipped.join("、") || "（無）"}（管理員帳號等不含圖片的表）`);
  p();
  p("完整逐檔清單（原始路徑、預計 public_id、批次、SHA-256）見同資料夾的 files.csv / files.json。");
  return L.join("\n") + "\n";
}
