/**
 * SQLite → Neon PostgreSQL 正式資料搬移核心（不含任何連線字串處理；連線由呼叫端提供）。
 *
 * 設計重點：
 * - 來源值統一成「Prisma 形狀」：DateTime＝Date、Boolean＝boolean、Int／Float＝number、String＝string、可空欄位＝null。
 * - 全部寫入在【單一交易】內：BEGIN → 鎖表 → 再確認每張表都是空的 → 依外鍵順序 INSERT → 筆數／內容雜湊／關聯驗證 → COMMIT。
 *   任何一步出錯或驗證不符，一律 ROLLBACK，Neon 回到 0 筆；本工具永遠不 TRUNCATE／DELETE。
 * - 時間以 UTC 字串（YYYY-MM-DD HH:MM:SS.mmm）寫入 timestamp(3)，讀回時用自訂解析器取回 UTC，不受執行電腦時區影響。
 * - 報告與錯誤訊息只含筆數、雜湊與表名，不含任何欄位內容（含 passwordHash）。
 */
import crypto from "crypto";
import { SOFT_REFS, type SchemaField, type SchemaModel } from "./pgPrecheckCore";

export type Row = Record<string, unknown>;
export type SourceData = Map<string, Row[]>;
export interface PgLike { query(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>; }

const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;
const INT_MIN = -2147483648, INT_MAX = 2147483647;

// ───────────────────────── 參數閘門 ─────────────────────────
export interface MigrateArgs { apply: boolean; confirm: boolean; expectTotal: number | null; verifyOnly: boolean; noNeon: boolean }
export function parseMigrateArgs(argv: string[]): { args: MigrateArgs; errors: string[] } {
  const errors: string[] = [];
  const has = (n: string) => argv.includes(n);
  let expectTotal: number | null = null;
  const i = argv.indexOf("--expect-total");
  if (i >= 0) {
    const raw = argv[i + 1];
    if (raw === undefined || !/^\d+$/.test(raw)) errors.push("--expect-total 必須是整數（例如 --expect-total 356）。");
    else expectTotal = Number(raw);
  }
  const args: MigrateArgs = { apply: has("--apply"), confirm: has("--confirm"), expectTotal, verifyOnly: has("--verify-only"), noNeon: has("--no-neon") };
  if (args.apply && args.verifyOnly) errors.push("--apply 與 --verify-only 不能同時使用。");
  if (args.apply && args.noNeon) errors.push("--apply 不能搭配 --no-neon。");
  if (args.apply && !args.confirm) errors.push("正式搬移必須同時加上 --confirm。");
  if (args.apply && expectTotal === null && !errors.some((e) => e.includes("--expect-total"))) errors.push("正式搬移必須加上 --expect-total <預期總筆數>（例如 --expect-total 356）。");
  return { args, errors };
}

/** 正式連線只接受 DIRECT_URL，且不得是 pooler。回傳錯誤訊息，沒問題回傳 null。 */
export function checkDirectUrl(url: string | undefined): string | null {
  if (!url) return "找不到環境變數 DIRECT_URL（請放在 .env.local，不要貼到對話）。正式寫入只使用 DIRECT_URL。";
  if (!/^postgres(ql)?:\/\//i.test(url)) return "DIRECT_URL 不是 PostgreSQL 連線字串。";
  let host = ""; try { host = new URL(url).hostname; } catch { return "DIRECT_URL 格式不正確。"; }
  if (/-pooler/i.test(host) || /pooler/i.test(host)) return "DIRECT_URL 指向 pooler（主機名稱含 pooler）。正式寫入必須使用直連（direct）連線字串，已停止。";
  return null;
}

// ───────────────────────── 值的正規化與雜湊 ─────────────────────────
export const pad = (n: number, w: number) => String(n).padStart(w, "0");
/** Date → 'YYYY-MM-DD HH:MM:SS.mmm'（UTC，PostgreSQL timestamp(3) 的字面值）。 */
export function pgTimestamp(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)} ${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}:${pad(d.getUTCSeconds(), 2)}.${pad(d.getUTCMilliseconds(), 3)}`;
}
/** 讀回 PostgreSQL timestamp 字串（不含時區）→ ISO UTC。 */
export function parsePgTimestamp(s: string): string {
  const m = /^(\d{4,})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)(?:\.(\d+))?/.exec(s);
  if (!m) throw new Error("無法解析 timestamp：" + s);
  return `${m[1]!.padStart(4, "0")}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${(m[7] ?? "").padEnd(3, "0").slice(0, 3)}Z`;
}
/** 給 pg Client 用：timestamp(1114) 以 UTC ISO 字串回傳，其他維持預設。 */
export function utcTypes(pgTypes: { getTypeParser(oid: number, format?: string): (v: string) => unknown }) {
  return { getTypeParser: (oid: number, format?: string) => (oid === 1114 ? (v: string) => parsePgTimestamp(v) : pgTypes.getTypeParser(oid, format)) };
}

function canon(f: SchemaField, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  switch (f.type) {
    case "DateTime": return v instanceof Date ? v.toISOString() : String(v);
    case "Boolean": return v === true || v === 1 || v === "t" || v === "true";
    case "Int": case "Float": return Number(v);
    default: return String(v);
  }
}
/** 單表內容雜湊：欄位依 schema 順序、列依主鍵排序、每個值帶型別標記；與 SQLite／PostgreSQL 的內部格式無關。 */
export function tableHash(m: SchemaModel, rows: Row[]): string {
  const key = (r: Row) => m.id.map((c) => String(canon(m.scalars.find((f) => f.name === c)!, r[c]))).join("\u0001");
  const sorted = [...rows].sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
  const h = crypto.createHash("sha256");
  h.update(`${m.name}|${m.scalars.map((f) => f.name + ":" + f.type).join(",")}\n`);
  for (const r of sorted) h.update(JSON.stringify(m.scalars.map((f) => { const v = canon(f, r[f.name]); return v === null ? ["n"] : [f.type[0], v]; })) + "\n");
  return h.digest("hex");
}

/** sql.js／node:sqlite 讀到的原始列 → Prisma 形狀（DateTime 在 SQLite 可能是毫秒整數或 ISO 字串）。 */
export function fromSqliteRaw(m: SchemaModel, raw: Row): Row {
  const out: Row = {};
  for (const f of m.scalars) {
    const v = raw[f.name];
    if (v === null || v === undefined) { out[f.name] = null; continue; }
    if (f.type === "DateTime") out[f.name] = typeof v === "number" ? new Date(v) : new Date(String(v));
    else if (f.type === "Boolean") out[f.name] = v === 1 || v === true || v === "1" || v === "true";
    else out[f.name] = v;
  }
  return out;
}

/** 外鍵順序：父表在前。 */
export function insertOrder(schema: SchemaModel[]): SchemaModel[] {
  const byName = new Map(schema.map((m) => [m.name, m])), done = new Set<string>(), out: SchemaModel[] = [], stack = new Set<string>();
  const visit = (m: SchemaModel) => {
    if (done.has(m.name)) return;
    if (stack.has(m.name)) throw new Error("schema 有循環外鍵：" + m.name);
    stack.add(m.name);
    for (const r of m.relations) { const p = byName.get(r.refModel); if (p && p !== m) visit(p); }
    stack.delete(m.name); done.add(m.name); out.push(m);
  };
  schema.forEach(visit);
  return out;
}

// ───────────────────────── 來源預檢（寫入前） ─────────────────────────
export interface Issue { severity: "blocking" | "warning"; code: string; table?: string; message: string }
export function checkSource(schema: SchemaModel[], data: SourceData): Issue[] {
  const out: Issue[] = [];
  for (const m of schema) {
    const rows = data.get(m.name);
    if (!rows) { out.push({ severity: "blocking", code: "missing-table", table: m.name, message: `來源缺少資料表 ${m.name}。` }); continue; }
    const seen = new Set<string>();
    const bad: Record<string, Set<string>> = {};
    const flag = (code: string, col: string) => { (bad[code + "|" + col] ??= new Set()).add(""); };
    const count: Record<string, number> = {};
    const bump = (code: string, col: string) => { const k = code + "|" + col; count[k] = (count[k] ?? 0) + 1; flag(code, col); };
    for (const r of rows) {
      const k = m.id.map((c) => String(r[c])).join("\u0001");
      if (seen.has(k)) bump("dup-pk", m.id.join("+")); seen.add(k);
      for (const f of m.scalars) {
        const v = r[f.name];
        if (v === null || v === undefined) { if (!f.optional) bump("null-required", f.name); continue; }
        if (f.type === "String") { if (typeof v !== "string") bump("type", f.name); else if (v.includes("\u0000")) bump("nul-char", f.name); }
        else if (f.type === "Int") { if (typeof v !== "number" || !Number.isInteger(v) || v < INT_MIN || v > INT_MAX) bump("int-range", f.name); }
        else if (f.type === "Float") { if (typeof v !== "number" || !Number.isFinite(v)) bump("float", f.name); }
        else if (f.type === "Boolean") { if (typeof v !== "boolean") bump("type", f.name); }
        else if (f.type === "DateTime") { if (!(v instanceof Date) || Number.isNaN(v.getTime()) || v.getUTCFullYear() < 1 || v.getUTCFullYear() > 9999) bump("date", f.name); }
      }
    }
    const MSG: Record<string, string> = { "dup-pk": "主鍵重複", "null-required": "必填欄位是 NULL", type: "值的型別與 schema 不符", "nul-char": "字串含 NUL(\\u0000) 字元，PostgreSQL 的 text 無法儲存", "int-range": "整數超出 PostgreSQL INTEGER 範圍或不是整數", float: "不是有限的數字", date: "日期無效或超出範圍" };
    for (const [k, n] of Object.entries(count)) { const [code, col] = k.split("|"); out.push({ severity: "blocking", code: code!, table: m.name, message: `${m.name}.${col}：${n} 筆${MSG[code!]}。` }); }
  }
  // 硬外鍵（PostgreSQL 會強制）
  const byName = new Map(schema.map((m) => [m.name, m]));
  for (const m of schema) for (const rel of m.relations) {
    const parent = byName.get(rel.refModel), prows = data.get(rel.refModel), rows = data.get(m.name); if (!parent || !prows || !rows) continue;
    const ids = new Set(prows.map((r) => rel.references.map((c) => String(r[c])).join("\u0001")));
    const orphans = rows.filter((r) => rel.fields.every((c) => r[c] !== null && r[c] !== undefined) && !ids.has(rel.fields.map((c) => String(r[c])).join("\u0001"))).length;
    if (orphans) out.push({ severity: "blocking", code: "fk-orphan", table: m.name, message: `${m.name}.${rel.fields.join(",")} → ${rel.refModel}：${orphans} 筆找不到父資料，PostgreSQL 外鍵會拒絕。` });
  }
  // 軟關聯（只提醒，不阻擋、不刪除、不略過）
  for (const s of SOFT_REFS) {
    const rows = data.get(s.table), parent = data.get(s.target); if (!rows || !parent) continue;
    const ids = new Set(parent.map((r) => String(r[s.targetCol]))); for (const e of s.allowExtra ?? []) ids.add(e);
    const n = rows.filter((r) => { if (s.when && !s.when(r)) return false; const v = r[s.column]; if (v === null || v === undefined || (s.nullable && v === "")) return false; return !ids.has(String(v)); }).length;
    if (n) out.push({ severity: "warning", code: "soft-orphan", table: s.table, message: `${s.table}.${s.column} → ${s.target}：${n} 筆找不到對應資料（不是外鍵；仍會原樣搬移，不刪除、不略過）。` });
  }
  return out;
}

// ───────────────────────── Neon 端 ─────────────────────────
export interface TableState { exists: boolean; missingColumns: string[]; count: number }
/** 唯讀：每張 model 的資料表是否存在、欄位是否齊全、目前筆數。 */
export async function inspectTarget(pg: PgLike, schema: SchemaModel[]): Promise<Map<string, TableState>> {
  const cols = await pg.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'");
  const have = new Map<string, Set<string>>();
  for (const c of cols.rows) { const t = String(c.table_name); (have.get(t) ?? have.set(t, new Set()).get(t)!).add(String(c.column_name)); }
  const out = new Map<string, TableState>();
  for (const m of schema) {
    const set = have.get(m.name);
    if (!set) { out.set(m.name, { exists: false, missingColumns: m.scalars.map((f) => f.name), count: 0 }); continue; }
    const count = Number((await pg.query(`SELECT COUNT(*)::bigint AS n FROM ${qi(m.name)}`)).rows[0]?.n ?? 0);
    out.set(m.name, { exists: true, missingColumns: m.scalars.filter((f) => !set.has(f.name)).map((f) => f.name), count });
  }
  return out;
}
export function targetProblems(schema: SchemaModel[], st: Map<string, TableState>): string[] {
  const p: string[] = [];
  for (const m of schema) {
    const s = st.get(m.name)!;
    if (!s.exists) p.push(`Neon 缺少資料表 ${m.name}。`);
    else if (s.missingColumns.length) p.push(`Neon 的 ${m.name} 缺少欄位：${s.missingColumns.join("、")}。`);
    else if (s.count !== 0) p.push(`Neon 的 ${m.name} 目前有 ${s.count} 筆資料，不是空的。`);
  }
  return p;
}

const BATCH_PARAM_LIMIT = 30000;
export function buildInserts(m: SchemaModel, rows: Row[]): { sql: string; params: unknown[] }[] {
  const per = Math.max(1, Math.min(200, Math.floor(BATCH_PARAM_LIMIT / m.scalars.length)));
  const out: { sql: string; params: unknown[] }[] = [];
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per), params: unknown[] = [], tuples: string[] = [];
    for (const r of chunk) {
      tuples.push("(" + m.scalars.map((f) => {
        const v = r[f.name];
        if (v === null || v === undefined) { params.push(null); return `$${params.length}`; }
        if (f.type === "DateTime") { params.push(pgTimestamp(v as Date)); return `$${params.length}::timestamp(3)`; }
        params.push(v); return `$${params.length}`;
      }).join(", ") + ")");
    }
    out.push({ sql: `INSERT INTO ${qi(m.name)} (${m.scalars.map((f) => qi(f.name)).join(", ")}) VALUES ${tuples.join(", ")}`, params });
  }
  return out;
}

/** 讀回 PostgreSQL 全表（Client 必須用 utcTypes 建立）並與來源比對。 */
export interface VerifyRow { table: string; sourceCount: number; targetCount: number; sourceHash: string; targetHash: string; ok: boolean }
export interface VerifyResult { tables: VerifyRow[]; hardOrphans: { table: string; relation: string; count: number }[]; softOrphans: { table: string; column: string; count: number }[]; ok: boolean }
export async function verifyTarget(pg: PgLike, schema: SchemaModel[], source: SourceData): Promise<VerifyResult> {
  const tables: VerifyRow[] = [];
  for (const m of schema) {
    const src = source.get(m.name) ?? [];
    const res = await pg.query(`SELECT ${m.scalars.map((f) => qi(f.name)).join(", ")} FROM ${qi(m.name)}`);
    const back = res.rows.map((r) => { const o: Row = {}; for (const f of m.scalars) { const v = r[f.name]; o[f.name] = f.type === "DateTime" && typeof v === "string" ? new Date(v) : v; } return o; });
    const sh = tableHash(m, src), th = tableHash(m, back);
    tables.push({ table: m.name, sourceCount: src.length, targetCount: back.length, sourceHash: sh, targetHash: th, ok: src.length === back.length && sh === th });
  }
  const hardOrphans: VerifyResult["hardOrphans"] = [];
  for (const m of schema) for (const rel of m.relations) {
    const on = rel.fields.map((c, i) => `c.${qi(c)} = p.${qi(rel.references[i]!)}`).join(" AND ");
    const notNull = rel.fields.map((c) => `c.${qi(c)} IS NOT NULL`).join(" AND ");
    const n = Number((await pg.query(`SELECT COUNT(*)::bigint AS n FROM ${qi(m.name)} c LEFT JOIN ${qi(rel.refModel)} p ON ${on} WHERE ${notNull} AND p.${qi(rel.references[0]!)} IS NULL`)).rows[0]?.n ?? 0);
    hardOrphans.push({ table: m.name, relation: `${m.name}.${rel.fields.join(",")} → ${rel.refModel}`, count: n });
  }
  // 軟關聯：用已讀回、已驗證與來源相同的資料在記憶體比對，結果必須與來源預檢一致
  const softOrphans = checkSource(schema, source).filter((i) => i.code === "soft-orphan").map((i) => ({ table: i.table!, column: i.message.split("：")[0]!, count: Number(/：(\d+) 筆/.exec(i.message)?.[1] ?? 0) }));
  const ok = tables.every((t) => t.ok) && hardOrphans.every((o) => o.count === 0);
  return { tables, hardOrphans, softOrphans, ok };
}

// ───────────────────────── 執行 ─────────────────────────
export type Outcome = "dry-run" | "refused" | "committed" | "rolled-back" | "verify-only";
export interface MigrationReport {
  mode: "dry-run" | "apply" | "verify-only";
  outcome: Outcome;
  startedAt: string;
  schemaTables: number;
  plan: { table: string; rows: number; targetRows: number | null; hash: string }[];
  sourceTotal: number;
  expectTotal: number | null;
  issues: Issue[];
  refusals: string[];
  targetChecked: boolean;
  insertedRows: number;
  verification: VerifyResult | null;
  postCommitVerification: VerifyResult | null;
  error: string | null;
  steps: string[];
}

export interface RunOptions {
  schema: SchemaModel[];
  source: SourceData;
  /** 與 Prisma 讀取結果做交叉比對用的獨立讀取（sql.js），表名 → 雜湊 */
  crossCheck?: SourceData | null;
  pg: PgLike | null;
  args: MigrateArgs;
  /** 呼叫端已知的拒絕原因（例如 pooler 連線、SQLite 有 WAL）；有任何一項就不會寫入。 */
  preRefusals?: string[];
  redact?: (s: string) => string;
  /** 測試用：在指定階段丟出錯誤，驗證 ROLLBACK。 */
  failAt?: (stage: string) => void | Promise<void>;
}

export async function runMigration(o: RunOptions): Promise<MigrationReport> {
  const { schema, source, pg, args } = o;
  const redact = o.redact ?? ((s: string) => s);
  const order = insertOrder(schema);
  const sourceTotal = order.reduce((n, m) => n + (source.get(m.name)?.length ?? 0), 0);
  const rep: MigrationReport = { mode: args.apply ? "apply" : args.verifyOnly ? "verify-only" : "dry-run", outcome: "dry-run", startedAt: new Date().toISOString(), schemaTables: schema.length, plan: [], sourceTotal, expectTotal: args.expectTotal, issues: [], refusals: [], targetChecked: false, insertedRows: 0, verification: null, postCommitVerification: null, error: null, steps: [] };
  const step = (s: string) => rep.steps.push(s);
  const refuse = (s: string) => { rep.refusals.push(s); };

  for (const x of o.preRefusals ?? []) refuse(x);
  // 1. 來源檢查
  rep.issues = checkSource(schema, source);
  if (o.crossCheck) {
    const diff = schema.filter((m) => tableHash(m, source.get(m.name) ?? []) !== tableHash(m, o.crossCheck!.get(m.name) ?? [])).map((m) => m.name);
    if (diff.length) rep.issues.push({ severity: "blocking", code: "reader-mismatch", message: `Prisma 讀到的內容與獨立讀取（sql.js）不一致：${diff.join("、")}。為避免搬錯資料，已停止。` });
    else step("Prisma 讀取結果與獨立讀取（sql.js）逐表雜湊完全一致。");
  }
  for (const i of rep.issues.filter((x) => x.severity === "blocking")) refuse(i.message);
  if (args.expectTotal !== null && args.expectTotal !== sourceTotal) refuse(`來源總筆數是 ${sourceTotal}，與 --expect-total ${args.expectTotal} 不符。`);

  // 2. Neon 狀態（唯讀）
  let state: Map<string, TableState> | null = null;
  if (pg && !args.noNeon) {
    try {
      await pg.query("BEGIN READ ONLY");
      try { state = await inspectTarget(pg, schema); } finally { await pg.query("ROLLBACK").catch(() => {}); }
      rep.targetChecked = true;
    } catch (e) { refuse("無法讀取 Neon：" + redact(String((e as Error).message))); }
  }
  rep.plan = order.map((m) => ({ table: m.name, rows: source.get(m.name)?.length ?? 0, targetRows: state?.get(m.name)?.exists ? state.get(m.name)!.count : null, hash: tableHash(m, source.get(m.name) ?? []) }));

  if (args.verifyOnly) {
    rep.outcome = "verify-only";
    if (!pg) { refuse("--verify-only 需要連線 Neon。"); }
    if (rep.refusals.length) { rep.outcome = "refused"; return rep; }
    try {
      await pg!.query("BEGIN READ ONLY");
      try { rep.verification = await verifyTarget(pg!, schema, source); } finally { await pg!.query("ROLLBACK").catch(() => {}); }
      step("已唯讀比對 Neon 現有資料與來源（沒有寫入）。");
    } catch (e) { rep.error = redact(String((e as Error).message)); rep.outcome = "refused"; }
    return rep;
  }

  if (state) for (const p of targetProblems(schema, state)) refuse(p);

  if (!args.apply) { rep.outcome = rep.refusals.length ? "refused" : "dry-run"; return rep; }

  // 3. 正式寫入
  if (!pg) { refuse("沒有 Neon 連線。"); }
  if (rep.refusals.length) { rep.outcome = "refused"; return rep; }

  let began = false;
  try {
    await pg!.query("BEGIN"); began = true; step("BEGIN（單一交易）");
    await pg!.query("SET LOCAL lock_timeout = '15s'");
    await pg!.query("SET LOCAL statement_timeout = '300s'");
    await pg!.query(`LOCK TABLE ${order.map((m) => qi(m.name)).join(", ")} IN ACCESS EXCLUSIVE MODE`); step("已鎖定 36 張表，防止同時寫入。");
    const again = await inspectTarget(pg!, schema);
    const prob = targetProblems(schema, again);
    if (prob.length) throw new Error("鎖表後再次檢查，Neon 不是全空：" + prob.join(" "));
    step("鎖表後再次確認每張表都是空的。");
    await o.failAt?.("before-insert");
    for (const m of order) {
      const rows = source.get(m.name) ?? [];
      for (const q of buildInserts(m, rows)) await pg!.query(q.sql, q.params);
      rep.insertedRows += rows.length;
      await o.failAt?.("after-insert:" + m.name);
    }
    step(`已在交易內寫入 ${rep.insertedRows} 筆。`);
    rep.verification = await verifyTarget(pg!, schema, source);
    await o.failAt?.("after-verify");
    if (!rep.verification.ok) throw new Error("交易內驗證不符（筆數、內容雜湊或外鍵）。");
    if (rep.insertedRows !== sourceTotal) throw new Error("寫入筆數與來源總筆數不符。");
    step("交易內驗證通過：各表筆數、內容 SHA-256、外鍵孤兒皆正常。");
    await pg!.query("COMMIT"); began = false; step("COMMIT 完成。");
    rep.outcome = "committed";
  } catch (e) {
    rep.error = redact(String((e as Error).message));
    if (began) { try { await pg!.query("ROLLBACK"); step("已 ROLLBACK：Neon 沒有留下任何資料。"); } catch (e2) { rep.error += "（ROLLBACK 也失敗：" + redact(String((e2 as Error).message)) + "；連線中斷時交易會由伺服器自動回復，請用 --verify-only 與 dry-run 確認狀態。）"; } }
    rep.outcome = "rolled-back";
    return rep;
  }

  // 4. COMMIT 後獨立再驗一次（新的唯讀交易）
  try {
    await pg!.query("BEGIN READ ONLY");
    try { rep.postCommitVerification = await verifyTarget(pg!, schema, source); } finally { await pg!.query("ROLLBACK").catch(() => {}); }
    step(rep.postCommitVerification.ok ? "COMMIT 後獨立驗證通過。" : "【警告】COMMIT 後獨立驗證不符！");
  } catch (e) { rep.error = "COMMIT 後驗證失敗：" + redact(String((e as Error).message)); }
  return rep;
}

// ───────────────────────── 報告 ─────────────────────────
const OUTCOME: Record<Outcome, string> = { "dry-run": "乾跑（沒有寫入任何資料）", refused: "已拒絕（沒有寫入任何資料）", committed: "✅ 已搬移並通過驗證", "rolled-back": "❌ 失敗，已完整回滾（Neon 仍是空的）", "verify-only": "唯讀驗證（沒有寫入）" };
export function reportMarkdown(r: MigrationReport): string {
  const L: string[] = [];
  L.push("# SQLite → Neon 資料搬移報告", "", `- 模式：${r.mode}`, `- 結果：**${OUTCOME[r.outcome]}**`, `- 時間（UTC）：${r.startedAt}`, `- 來源總筆數：${r.sourceTotal}（${r.schemaTables} 張表）${r.expectTotal !== null ? `；--expect-total ${r.expectTotal}` : ""}`);
  if (r.error) L.push(`- 錯誤：${r.error}`);
  if (r.refusals.length) { L.push("", "## 拒絕原因", ...r.refusals.map((x) => `- ${x}`)); }
  const warn = r.issues.filter((i) => i.severity === "warning");
  if (warn.length) L.push("", "## 提醒（不阻擋，資料仍原樣搬移）", ...warn.map((i) => `- ${i.message}`));
  L.push("", "## 各表計畫／結果", "", "| 資料表 | 來源筆數 | Neon 目前筆數 | 內容 SHA-256（前 16 碼） |", "|---|---:|---:|---|");
  for (const p of r.plan) L.push(`| ${p.table} | ${p.rows} | ${p.targetRows ?? "—"} | ${p.hash.slice(0, 16)} |`);
  const v = (title: string, x: VerifyResult | null) => {
    if (!x) return;
    L.push("", `## ${title}：${x.ok ? "✅ 全部相符" : "❌ 有不符"}`, "", "| 資料表 | 來源 | Neon | 雜湊相符 |", "|---|---:|---:|---|");
    for (const t of x.tables) L.push(`| ${t.table} | ${t.sourceCount} | ${t.targetCount} | ${t.ok ? "✅" : "❌"} |`);
    const bad = x.hardOrphans.filter((o) => o.count); L.push("", bad.length ? "外鍵孤兒：" + bad.map((o) => `${o.relation}=${o.count}`).join("；") : `外鍵孤兒：0（檢查 ${x.hardOrphans.length} 組外鍵）`);
  };
  v("交易內驗證", r.verification); v("COMMIT 後獨立驗證", r.postCommitVerification);
  if (r.steps.length) L.push("", "## 步驟紀錄", ...r.steps.map((s) => `- ${s}`));
  L.push("", "> 報告不含任何欄位內容、連線字串、密碼或 passwordHash。");
  return L.join("\n") + "\n";
}
export function planCsv(r: MigrationReport): string {
  return "﻿" + ["table,rows,targetRows,sha256", ...r.plan.map((p) => `${p.table},${p.rows},${p.targetRows ?? ""},${p.hash}`)].join("\r\n") + "\r\n";
}

// ───────────────────────── 來源讀取輔助 ─────────────────────────
/** 把專案的 schema.prisma 轉成「讀 SQLite 複本用」的 schema：換掉 generator／datasource，其餘 model 原封不動。 */
export function toSqliteReaderSchema(text: string, outputDir: string, dbPath: string): string {
  const stripped = text.replace(/^(generator|datasource)\s+\w+\s*\{[\s\S]*?^\}[ \t]*\r?\n?/gm, "");
  const fwd = (p: string) => p.replace(/\\/g, "/");
  return `generator client {\n  provider = "prisma-client-js"\n  output   = "${fwd(outputDir)}"\n}\n\ndatasource db {\n  provider = "sqlite"\n  url      = "file:${fwd(dbPath)}"\n}\n\n${stripped}`;
}
/** 獨立讀取（sql.js，記憶體內，不寫入任何檔案）→ Prisma 形狀。 */
export async function readSqlJs(schema: SchemaModel[], bytes: Uint8Array): Promise<SourceData> {
  const SQL = await require("sql.js")();
  const db = new SQL.Database(bytes);
  try {
    const out: SourceData = new Map();
    for (const m of schema) {
      let res: { columns: string[]; values: unknown[][] }[];
      try { res = db.exec(`SELECT ${m.scalars.map((f) => qi(f.name)).join(", ")} FROM ${qi(m.name)}`); } catch (e) { throw new Error(`SQLite 讀取 ${m.name} 失敗：${(e as Error).message}`); }
      const rows = res.length ? res[0]!.values.map((v) => fromSqliteRaw(m, Object.fromEntries(res[0]!.columns.map((c, i) => [c, v[i]])))) : [];
      out.set(m.name, rows);
    }
    return out;
  } finally { db.close(); }
}
