/**
 * SQLite → Neon PostgreSQL「搬移前唯讀預檢」的核心（純函式＋唯讀查詢介面，可獨立測試）。
 *
 * 絕對唯讀：
 *  - SQLite 只以「讀取位元組到記憶體」的方式載入（sql.js），完全不會寫回檔案；CLI 另外先複製一份再讀，並比對原檔 SHA-256 前後相同。
 *  - Neon 只允許 SELECT／SHOW／WITH（guardReadOnlySql），且整個預檢在 READ ONLY 交易中執行。
 *  - 報告與錯誤訊息不含連線字串、密碼、passwordHash。
 */
import { extractUploadUrls } from "./uploadsAuditCore";
import { parseUploadUrl } from "../../lib/storage/cloudinary";

// ───────────────────────── Prisma schema 解析（與 provider 無關） ─────────────────────────
const SCALARS = new Set(["String", "Int", "Float", "Boolean", "DateTime", "BigInt", "Json", "Decimal", "Bytes"]);
/** strong＝欄位註解／名稱明確說是 JSON（必須能解析）；weak＝只有上方的說明文字提到 JSON（只在內容長得像 JSON 時才檢查）。 */
export interface SchemaField { name: string; type: string; optional: boolean; list: boolean; isId: boolean; unique: boolean; comment: string; hasDefault: boolean; jsonHint: "strong" | "weak" | null }
export interface SchemaRelation { fields: string[]; references: string[]; refModel: string; onDelete: string }
export interface SchemaModel { name: string; scalars: SchemaField[]; id: string[]; uniques: string[][]; indexes: string[][]; relations: SchemaRelation[] }

export function parsePrismaSchema(text: string): SchemaModel[] {
  const models: SchemaModel[] = [];
  for (const m of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const model: SchemaModel = { name: m[1]!, scalars: [], id: [], uniques: [], indexes: [], relations: [] };
    let pending: string[] = [];
    for (const raw of m[2]!.split(/\r?\n/)) {
      const ci = raw.indexOf("//");
      const comment = ci >= 0 ? raw.slice(ci + 2).trim() : "";
      const line = (ci >= 0 ? raw.slice(0, ci) : raw).trim();
      if (!line) { if (ci >= 0) pending.push(comment); else pending = []; continue; }
      const above = pending.join(" "); pending = [];
      const cols = (s: string) => s.split(",").map((x) => x.trim().replace(/\(.*\)$/, "")).filter(Boolean);
      if (line.startsWith("@@")) {
        const arr = /\[([^\]]*)\]/.exec(line);
        if (!arr) continue;
        if (line.startsWith("@@id")) model.id = cols(arr[1]!);
        else if (line.startsWith("@@unique")) model.uniques.push(cols(arr[1]!));
        else if (line.startsWith("@@index")) model.indexes.push(cols(arr[1]!));
        continue;
      }
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const [name, typeRaw] = parts as [string, string];
      const list = typeRaw.endsWith("[]");
      const optional = typeRaw.endsWith("?");
      const type = typeRaw.replace(/\[\]|\?/g, "");
      if (SCALARS.has(type)) {
        const strong = type === "String" && (/json/i.test(comment) || /json$/i.test(name));
        const weak = type === "String" && !strong && (/json/i.test(above) || /\[\{|\{\s*"/.test(above + comment));
        const f: SchemaField = { name, type, optional, list, isId: /@id\b/.test(line), unique: /@unique\b/.test(line), comment, hasDefault: /@default\(/.test(line), jsonHint: strong ? "strong" : weak ? "weak" : null };
        model.scalars.push(f);
        if (f.isId) model.id = [name];
        if (f.unique) model.uniques.push([name]);
      } else {
        const r = /@relation\(([^)]*)\)/.exec(line);
        const fields = r && /fields:\s*\[([^\]]*)\]/.exec(r[1]!);
        const refs = r && /references:\s*\[([^\]]*)\]/.exec(r[1]!);
        if (fields && refs) model.relations.push({ fields: cols(fields[1]!), references: cols(refs[1]!), refModel: type, onDelete: (/onDelete:\s*(\w+)/.exec(r![1]!)?.[1] ?? "Restrict") });
      }
    }
    models.push(model);
  }
  return models;
}

// ───────────────────────── 唯讀 SQL 守門 ─────────────────────────
export function guardReadOnlySql(sql: string): string {
  const s = sql.trim().replace(/;\s*$/, "");
  if (!/^(SELECT|SHOW|WITH|PRAGMA\s+(table_info|index_list|index_info|foreign_key_list|integrity_check|table_xinfo))\b/i.test(s)) throw new Error("預檢工具只允許唯讀查詢（SELECT／SHOW／WITH／唯讀 PRAGMA）：" + s.slice(0, 40));
  if (s.includes(";")) throw new Error("預檢工具不允許一次執行多個語句。");
  if (/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|VACUUM|REINDEX|CLUSTER)\b/i.test(s.replace(/'[^']*'|"[^"]*"/g, ""))) throw new Error("查詢含有寫入關鍵字，已拒絕：" + s.slice(0, 40));
  return s;
}

// ───────────────────────── 快照 ─────────────────────────
export interface SqliteTable { columns: { name: string; type: string; notnull: boolean; pk: number }[]; uniques: string[][]; indexes: string[][]; fks: { from: string[]; table: string; to: string[]; onDelete: string }[]; rows: Record<string, unknown>[] }
export interface SqliteSnapshot { integrity: string[]; tables: Map<string, SqliteTable>; queryCount: number }
export type SqliteExec = (sql: string) => Record<string, unknown>[];

export function snapshotSqlite(exec: SqliteExec): SqliteSnapshot {
  let queryCount = 0;
  const q = (sql: string) => { queryCount++; return exec(guardReadOnlySql(sql)); };
  const qi = (n: string) => `"${n.replace(/"/g, '""')}"`;
  const integrity = q("PRAGMA integrity_check").map((r) => String(Object.values(r)[0]));
  const names = q("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((r) => String(r.name));
  const tables = new Map<string, SqliteTable>();
  for (const name of names) {
    const columns = q(`PRAGMA table_info(${qi(name)})`).map((c) => ({ name: String(c.name), type: String(c.type ?? "").toUpperCase(), notnull: Number(c.notnull) === 1, pk: Number(c.pk) }));
    const uniques: string[][] = [], indexes: string[][] = [];
    for (const ix of q(`PRAGMA index_list(${qi(name)})`)) {
      const cols = q(`PRAGMA index_info(${qi(String(ix.name))})`).sort((a, b) => Number(a.seqno) - Number(b.seqno)).map((c) => String(c.name));
      if (String(ix.origin) === "pk") continue;
      (Number(ix.unique) === 1 ? uniques : indexes).push(cols);
    }
    const fkMap = new Map<number, { from: string[]; table: string; to: string[]; onDelete: string }>();
    for (const f of q(`PRAGMA foreign_key_list(${qi(name)})`)) {
      const id = Number(f.id); const cur = fkMap.get(id) ?? { from: [], table: String(f.table), to: [], onDelete: String(f.on_delete) };
      cur.from.push(String(f.from)); cur.to.push(String(f.to)); fkMap.set(id, cur);
    }
    const rows = q(`SELECT * FROM ${qi(name)}`);
    tables.set(name, { columns, uniques, indexes, fks: [...fkMap.values()], rows });
  }
  return { integrity, tables, queryCount };
}

export interface PgTable { columns: { name: string; dataType: string; nullable: boolean; precision: number | null }[]; pk: string[]; uniques: string[][]; indexes: string[][]; fks: { cols: string[]; refTable: string; refCols: string[]; onDelete: string }[]; count: number }
export interface PgSnapshot { readOnly: string; defaultReadOnly: string; tables: Map<string, PgTable>; statTotal: number; queryCount: number }
export type PgQuery = (sql: string) => Promise<Record<string, unknown>[]>;
const DEL: Record<string, string> = { a: "NoAction", r: "Restrict", c: "Cascade", n: "SetNull", d: "SetDefault" };
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : []);

export async function snapshotPg(rawQuery: PgQuery): Promise<PgSnapshot> {
  let queryCount = 0;
  const q: PgQuery = async (sql) => { queryCount++; return rawQuery(guardReadOnlySql(sql)); };
  const readOnly = String((await q("SHOW transaction_read_only"))[0]?.transaction_read_only ?? "?");
  const defaultReadOnly = String((await q("SHOW default_transaction_read_only"))[0]?.default_transaction_read_only ?? "?");
  const stat = async () => Number((await q("SELECT COALESCE(SUM(n_tup_ins + n_tup_upd + n_tup_del), 0)::bigint AS total FROM pg_stat_user_tables"))[0]?.total ?? 0);
  const statTotal = await stat();
  const tableNames = (await q("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")).map((r) => String(r.table_name));
  const cols = await q("SELECT table_name, column_name, data_type, is_nullable, datetime_precision FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
  const cons = await q(`SELECT c.contype::text AS contype, cl.relname::text AS tbl, fcl.relname::text AS ftbl, c.confdeltype::text AS deltype,
      (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS cols,
      (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) AS fcols
    FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace LEFT JOIN pg_class fcl ON fcl.oid = c.confrelid
    WHERE n.nspname = 'public' AND c.contype IN ('p', 'u', 'f')`);
  const idx = await q(`SELECT t.relname::text AS tbl, ix.indisunique AS uniq, ix.indisprimary AS prim,
      (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(ix.indkey::int2[]) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum) AS cols
    FROM pg_index ix JOIN pg_class t ON t.oid = ix.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'`);
  const tables = new Map<string, PgTable>();
  for (const name of tableNames) {
    const count = Number((await q(`SELECT COUNT(*)::bigint AS n FROM "${name.replace(/"/g, '""')}"`))[0]?.n ?? 0);
    tables.set(name, { columns: [], pk: [], uniques: [], indexes: [], fks: [], count });
  }
  for (const c of cols) tables.get(String(c.table_name))?.columns.push({ name: String(c.column_name), dataType: String(c.data_type), nullable: String(c.is_nullable) === "YES", precision: c.datetime_precision == null ? null : Number(c.datetime_precision) });
  for (const c of cons) {
    const t = tables.get(String(c.tbl)); if (!t) continue;
    if (c.contype === "p") t.pk = arr(c.cols);
    else if (c.contype === "f") t.fks.push({ cols: arr(c.cols), refTable: String(c.ftbl), refCols: arr(c.fcols), onDelete: DEL[String(c.deltype)] ?? String(c.deltype) });
  }
  for (const i of idx) {
    const t = tables.get(String(i.tbl)); if (!t || i.prim === true) continue;
    (i.uniq === true ? t.uniques : t.indexes).push(arr(i.cols));
  }
  const statAfter = await stat();
  if (statAfter !== statTotal) throw new Error("預檢期間 Neon 的寫入統計發生變化（可能是其他程式在寫入），請稍後重跑。");
  return { readOnly, defaultReadOnly, tables, statTotal, queryCount };
}

// ───────────────────────── 分析 ─────────────────────────
export type Severity = "blocking" | "warning" | "info";
export type Section = "schema" | "data" | "relation" | "cloudinary" | "admin" | "counts";
export interface Finding { severity: Severity; section: Section; table?: string; column?: string; code: string; message: string; rows?: string[] }
export interface LedgerInfo { verified: Map<string, string>; path: string }
export interface Condition { ok: boolean; label: string; detail?: string }
export interface PrecheckReport {
  generatedAt: string;
  sqliteIntegrity: string[];
  models: string[];
  sqliteCounts: Record<string, number | null>;
  pgCounts: Record<string, number | null>;
  sqliteTotal: number; pgTotal: number | null;
  findings: Finding[];
  cloudinary: { referencedUrls: number; verified: number; notInLedger: string[]; unparseable: string[]; ledgerOnlyCount: number; ledgerPath: string | null };
  admin: { sqliteRows: number | null; bcryptLooking: number | null; neonRows: number | null; sameInNeon: number | null };
  readOnlyEvidence: string[];
  conditions: Condition[];
  eligible: boolean;
}

const PG_TYPE: Record<string, string> = { String: "text", Int: "integer", Float: "double precision", Boolean: "boolean", DateTime: "timestamp without time zone" };
const SQLITE_TYPE: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME" };
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
const hasSet = (list: string[][], x: string[]) => list.some((l) => sameSet(l, x));
export const SOFT_REFS: { table: string; column: string; target: string; targetCol: string; when?: (row: Record<string, unknown>) => boolean; allowExtra?: string[]; nullable?: boolean; note: string }[] = [
  { table: "CampusSpot", column: "category", target: "CampusCategory", targetCol: "id", allowExtra: ["culture", "school_units"], note: "校園座標分類（空的分類表時，程式把 culture／school_units 當預設分類）" },
  { table: "ChineseStageAnimation", column: "stageId", target: "ChineseStage", targetCol: "id", note: "每關答題動畫對應的關卡" },
  { table: "AnnouncementLinkSet", column: "announcementId", target: "Announcement", targetCol: "id", note: "公告文字連結設定對應的公告" },
  { table: "InfoBoxImage", column: "boxId", target: "CampusSpot", targetCol: "id", when: (r) => r.scope === "campus", note: "資訊框裝飾圖（校園）對應的校園座標" },
  { table: "InfoBoxImage", column: "boxId", target: "LifeItem", targetCol: "id", when: (r) => r.scope === "life", note: "資訊框裝飾圖（生活）對應的生活項目" },
  { table: "PhotoSubmission", column: "reviewerId", target: "Admin", targetCol: "id", nullable: true, note: "投稿審核者（管理員）" },
];
/** 這個值需不需要做 JSON 解析檢查。 */
const needsJsonCheck = (f: SchemaField, v: string) => !!f.jsonHint && (f.jsonHint === "strong" || /^\s*[\[{]/.test(v));

export function analyze(input: {
  schema: SchemaModel[];
  sqlite: SqliteSnapshot | null;
  pg: PgSnapshot | null;
  ledger: LedgerInfo | null;
  expectTotal?: number;
  originalUnchanged?: boolean | null;
  now?: Date;
}): PrecheckReport {
  const { schema, sqlite, pg } = input;
  const F: Finding[] = [];
  const add = (f: Finding) => F.push(f);
  const models = schema.map((m) => m.name);
  const byName = new Map(schema.map((m) => [m.name, m]));

  // ── 筆數 ──
  const sqliteCounts: Record<string, number | null> = {}, pgCounts: Record<string, number | null> = {};
  for (const m of models) { sqliteCounts[m] = sqlite ? (sqlite.tables.get(m)?.rows.length ?? null) : null; pgCounts[m] = pg ? (pg.tables.get(m)?.count ?? null) : null; }
  const sum = (c: Record<string, number | null>) => Object.values(c).reduce<number>((n, v) => n + (v ?? 0), 0);
  const sqliteTotal = sum(sqliteCounts), pgTotal = pg ? sum(pgCounts) : null;
  if (input.expectTotal !== undefined && sqlite && sqliteTotal !== input.expectTotal) add({ severity: "warning", section: "counts", code: "total-differs", message: `SQLite 合計 ${sqliteTotal} 筆，與預期的 ${input.expectTotal} 筆不同。` });

  // ── Schema：資料表與欄位 ──
  if (sqlite) {
    for (const m of models) if (!sqlite.tables.has(m)) add({ severity: "blocking", section: "schema", table: m, code: "sqlite-missing-table", message: `SQLite 沒有資料表 ${m}（程式的 schema 有）。` });
    for (const [name, t] of sqlite.tables) {
      if (name.startsWith("_prisma")) continue;
      const model = byName.get(name);
      if (!model) { add({ severity: t.rows.length ? "blocking" : "warning", section: "schema", table: name, code: "sqlite-extra-table", message: `SQLite 有資料表 ${name}（${t.rows.length} 筆）不在 schema 內，不會被搬移。` }); continue; }
      const known = new Set(model.scalars.map((f) => f.name));
      for (const c of t.columns) if (!known.has(c.name)) {
        const filled = t.rows.filter((r) => r[c.name] !== null && r[c.name] !== undefined && r[c.name] !== "").length;
        add({ severity: filled ? "blocking" : "warning", section: "schema", table: name, column: c.name, code: "sqlite-extra-column", message: `SQLite 的 ${name}.${c.name} 不在 schema 內（${filled} 筆有值），不會被搬移。` });
      }
      for (const f of model.scalars) {
        const c = t.columns.find((x) => x.name === f.name);
        if (!c) { add({ severity: "blocking", section: "schema", table: name, column: f.name, code: "sqlite-missing-column", message: `SQLite 的 ${name} 缺少欄位 ${f.name}（可能是舊版資料庫，尚未更新結構）。` }); continue; }
        if (c.type && SQLITE_TYPE[f.type] && c.type !== SQLITE_TYPE[f.type]) add({ severity: "warning", section: "schema", table: name, column: f.name, code: "sqlite-type", message: `SQLite 欄位 ${name}.${f.name} 型別為 ${c.type}，schema 預期 ${SQLITE_TYPE[f.type]}。` });
        if (c.notnull === f.optional) add({ severity: "warning", section: "schema", table: name, column: f.name, code: "sqlite-nullability", message: `SQLite 欄位 ${name}.${f.name} 的 NOT NULL 與 schema 不同（schema ${f.optional ? "可空" : "必填"}）。` });
      }
      if (model.id.length && !sameSet(t.columns.filter((c) => c.pk > 0).map((c) => c.name), model.id)) add({ severity: "warning", section: "schema", table: name, code: "sqlite-pk", message: `SQLite ${name} 的主鍵與 schema 不同。` });
      for (const u of model.uniques) if (!hasSet(t.uniques, u)) add({ severity: "info", section: "schema", table: name, code: "sqlite-missing-unique", message: `SQLite ${name} 沒有唯一限制 (${u.join(", ")})。` });
    }
  }
  if (pg) {
    for (const m of models) if (!pg.tables.has(m)) add({ severity: "blocking", section: "schema", table: m, code: "pg-missing-table", message: `Neon 沒有資料表 ${m}。` });
    for (const [name, t] of pg.tables) {
      const model = byName.get(name);
      if (!model) { add({ severity: "info", section: "schema", table: name, code: "pg-extra-table", message: `Neon 有資料表 ${name}（${t.count} 筆）不在 schema 內。` }); continue; }
      const known = new Set(model.scalars.map((f) => f.name));
      for (const c of t.columns) if (!known.has(c.name)) add({ severity: "info", section: "schema", table: name, column: c.name, code: "pg-extra-column", message: `Neon 的 ${name}.${c.name} 不在 schema 內。` });
      for (const f of model.scalars) {
        const c = t.columns.find((x) => x.name === f.name);
        if (!c) { add({ severity: "blocking", section: "schema", table: name, column: f.name, code: "pg-missing-column", message: `Neon 的 ${name} 缺少欄位 ${f.name}。` }); continue; }
        if (PG_TYPE[f.type] && c.dataType !== PG_TYPE[f.type]) add({ severity: "blocking", section: "schema", table: name, column: f.name, code: "pg-type", message: `Neon 欄位 ${name}.${f.name} 型別為 ${c.dataType}，schema 預期 ${PG_TYPE[f.type]}。` });
        if (c.nullable && !f.optional) add({ severity: "warning", section: "schema", table: name, column: f.name, code: "pg-nullable-extra", message: `Neon 欄位 ${name}.${f.name} 允許空值，但 schema 為必填。` });
        if (!c.nullable && f.optional) add({ severity: "blocking", section: "schema", table: name, column: f.name, code: "pg-notnull", message: `Neon 欄位 ${name}.${f.name} 是 NOT NULL，但 schema 為可空（搬移空值會失敗）。` });
      }
      if (model.id.length && !sameSet(t.pk, model.id)) add({ severity: "blocking", section: "schema", table: name, code: "pg-pk", message: `Neon ${name} 的主鍵 (${t.pk.join(", ") || "無"}) 與 schema (${model.id.join(", ")}) 不同。` });
      for (const u of model.uniques) if (!hasSet(t.uniques, u)) add({ severity: "warning", section: "schema", table: name, code: "pg-missing-unique", message: `Neon ${name} 缺少唯一限制 (${u.join(", ")})。` });
      for (const ix of model.indexes) if (!hasSet(t.indexes, ix) && !hasSet(t.uniques, ix)) add({ severity: "info", section: "schema", table: name, code: "pg-missing-index", message: `Neon ${name} 缺少索引 (${ix.join(", ")})。` });
      for (const r of model.relations) {
        const fk = t.fks.find((x) => sameSet(x.cols, r.fields) && x.refTable === r.refModel);
        if (!fk) add({ severity: "warning", section: "schema", table: name, code: "pg-missing-fk", message: `Neon ${name}(${r.fields.join(", ")}) → ${r.refModel} 缺少外鍵。` });
        else if (fk.onDelete.toLowerCase() !== r.onDelete.toLowerCase() && !(r.onDelete === "Restrict" && fk.onDelete === "NoAction")) add({ severity: "warning", section: "schema", table: name, code: "pg-fk-rule", message: `Neon ${name} → ${r.refModel} 外鍵的刪除規則為 ${fk.onDelete}，schema 為 ${r.onDelete}。` });
      }
    }
    for (const [name, t] of pg.tables) if (byName.has(name) && t.count > 0) add({ severity: "blocking", section: "counts", table: name, code: "pg-not-empty", message: `Neon 的 ${name} 已有 ${t.count} 筆資料，目標必須是空的。` });
  }
  if (sqlite && pg) {
    for (const [name, t] of sqlite.tables) {
      const p = pg.tables.get(name); if (!p || !byName.has(name)) continue;
      const pgCols = new Set(p.columns.map((c) => c.name));
      for (const c of t.columns) if (!pgCols.has(c.name)) {
        const filled = t.rows.filter((r) => r[c.name] !== null && r[c.name] !== undefined && r[c.name] !== "").length;
        if (filled) add({ severity: "blocking", section: "schema", table: name, column: c.name, code: "data-without-target", message: `SQLite 的 ${name}.${c.name} 有 ${filled} 筆資料，但 Neon 沒有對應欄位。` });
      }
    }
  }

  // ── 資料掃描（SQLite） ──
  const hardOrphans: string[] = [];
  if (sqlite) {
    const idOf = (m: SchemaModel, r: Record<string, unknown>, i: number) => (m.id.length ? m.id.map((k) => String(r[k] ?? "")).join("/") : `#${i + 1}`).slice(0, 40);
    for (const m of schema) {
      const t = sqlite.tables.get(m.name); if (!t) continue;
      const present = new Set(t.columns.map((c) => c.name));
      const bucket = new Map<string, { sev: Severity; code: string; msg: string; rows: string[] }>();
      const flag = (col: string, code: string, sev: Severity, rowId: string, msg: string) => {
        const k = `${col}|${code}`; const b = bucket.get(k) ?? { sev, code, msg, rows: [] };
        b.rows.push(rowId); bucket.set(k, b);
      };
      t.rows.forEach((r, i) => {
        const rid = idOf(m, r, i);
        for (const f of m.scalars) {
          if (!present.has(f.name)) continue;
          const v = r[f.name];
          if (v === null || v === undefined) { if (!f.optional) flag(f.name, "null-in-required", "blocking", rid, "必填欄位出現空值"); continue; }
          if (f.type === "String") {
            if (typeof v !== "string") { flag(f.name, "not-text", "blocking", rid, "文字欄位的實際值不是文字"); continue; }
            if (v.includes("\u0000")) flag(f.name, "nul-char", "blocking", rid, "含有空字元（\\0），PostgreSQL 不接受");
          } else if (f.type === "Int") {
            if (typeof v !== "number" || !Number.isInteger(v)) flag(f.name, "not-int", "blocking", rid, "整數欄位的實際值不是整數");
            else if (v > 2147483647 || v < -2147483648) flag(f.name, "int-range", "blocking", rid, "整數超出 PostgreSQL integer 範圍");
          } else if (f.type === "Float") {
            if (typeof v !== "number" || !Number.isFinite(v)) flag(f.name, "not-float", "blocking", rid, "浮點欄位的實際值不是有限數字");
          } else if (f.type === "Boolean") {
            if (!(v === 0 || v === 1 || v === true || v === false)) flag(f.name, "not-bool", "blocking", rid, "布林欄位的實際值不是 0／1");
          } else if (f.type === "DateTime") {
            const ms = typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : NaN;
            if (!Number.isFinite(ms) || ms < Date.UTC(1990, 0, 1) || ms > Date.UTC(2100, 0, 1)) flag(f.name, "bad-date", "blocking", rid, "日期無法解析或不在合理範圍（1990–2100）");
          }
          if (f.type === "String" && typeof v === "string" && v !== "" && needsJsonCheck(f, v)) {
            try { JSON.parse(v); } catch { flag(f.name, "bad-json", "warning", rid, "JSON 字串無法解析"); }
          }
        }
      });
      for (const [k, b] of bucket) {
        const [col] = k.split("|");
        add({ severity: b.sev, section: "data", table: m.name, column: col, code: b.code, message: `${m.name}.${col}：${b.msg}（${b.rows.length} 筆）`, rows: b.rows.slice(0, 20) });
      }
      for (const u of m.uniques) {
        if (!u.every((c) => present.has(c))) continue;
        const seen = new Map<string, string[]>();
        t.rows.forEach((r, i) => { if (u.some((c) => r[c] === null || r[c] === undefined)) return; const key = JSON.stringify(u.map((c) => r[c])); seen.set(key, [...(seen.get(key) ?? []), idOf(m, r, i)]); });
        const dups = [...seen.values()].filter((x) => x.length > 1);
        if (dups.length) add({ severity: "blocking", section: "data", table: m.name, code: "unique-duplicate", message: `${m.name} 的唯一欄位 (${u.join(", ")}) 有 ${dups.length} 組重複。`, rows: dups.slice(0, 20).map((d) => d.join(" = ")) });
      }
    }
    // 外鍵孤兒（schema 的真外鍵）
    for (const m of schema) {
      const t = sqlite.tables.get(m.name); if (!t) continue;
      for (const rel of m.relations) {
        const parent = sqlite.tables.get(rel.refModel); if (!parent) continue;
        const keys = new Set(parent.rows.map((r) => JSON.stringify(rel.references.map((c) => r[c]))));
        const bad: string[] = [];
        t.rows.forEach((r, i) => { const vals = rel.fields.map((c) => r[c]); if (vals.some((v) => v === null || v === undefined)) return; if (!keys.has(JSON.stringify(vals))) bad.push(idOf(m, r, i)); });
        if (bad.length) { add({ severity: "blocking", section: "relation", table: m.name, code: "fk-orphan", message: `${m.name}(${rel.fields.join(", ")}) → ${rel.refModel}：${bad.length} 筆找不到上層資料。`, rows: bad.slice(0, 20) }); hardOrphans.push(m.name); }
      }
    }
    // 沒有資料庫外鍵、但程式依賴的關聯
    for (const s of SOFT_REFS) {
      const t = sqlite.tables.get(s.table), parent = sqlite.tables.get(s.target); if (!t || !parent) continue;
      const ids = new Set(parent.rows.map((r) => String(r[s.targetCol])));
      for (const e of s.allowExtra ?? []) ids.add(e);
      const mm = byName.get(s.table)!;
      const bad: string[] = [];
      t.rows.forEach((r, i) => { if (s.when && !s.when(r)) return; const v = r[s.column]; if (v === null || v === undefined || (s.nullable && v === "")) return; if (!ids.has(String(v))) bad.push(idOf(mm, r, i)); });
      if (bad.length) add({ severity: "warning", section: "relation", table: s.table, column: s.column, code: "soft-orphan", message: `${s.table}.${s.column} → ${s.target}.${s.targetCol}（${s.note}）：${bad.length} 筆找不到對應資料。這不是資料庫外鍵，搬移不會失敗，但網站該功能可能已經失效。`, rows: bad.slice(0, 20) });
      else add({ severity: "info", section: "relation", table: s.table, column: s.column, code: "soft-ok", message: `${s.table}.${s.column} → ${s.target}（${s.note}）：全部對得上。` });
    }
  }

  // ── Cloudinary 圖片路徑 ──
  const cloud = { referencedUrls: 0, verified: 0, notInLedger: [] as string[], unparseable: [] as string[], ledgerOnlyCount: 0, ledgerPath: input.ledger?.path ?? null };
  if (sqlite) {
    const urls = new Set<string>();
    for (const m of schema) {
      if (m.name === "Admin") continue;
      const t = sqlite.tables.get(m.name); if (!t) continue;
      const strCols = m.scalars.filter((f) => f.type === "String" && t.columns.some((c) => c.name === f.name)).map((f) => f.name);
      for (const r of t.rows) for (const c of strCols) { const v = r[c]; if (typeof v === "string" && v.includes("/uploads/")) for (const u of extractUploadUrls(v)) urls.add(u); }
    }
    cloud.referencedUrls = urls.size;
    for (const u of [...urls].sort()) {
      if (!parseUploadUrl(u)) { cloud.unparseable.push(u); continue; }
      if (input.ledger?.verified.has(u)) cloud.verified++; else cloud.notInLedger.push(u);
    }
    if (input.ledger) cloud.ledgerOnlyCount = [...input.ledger.verified.keys()].filter((u) => !urls.has(u)).length;
    if (!input.ledger) add({ severity: "warning", section: "cloudinary", code: "no-ledger", message: "找不到 Cloudinary 搬移帳本（ledger.jsonl），無法核對圖片路徑。可用 --ledger 指定。" });
    if (cloud.unparseable.length) add({ severity: "warning", section: "cloudinary", code: "unparseable-url", message: `${cloud.unparseable.length} 個 /uploads/ 路徑不符合網站讀取規則，網站本來就讀不到。`, rows: cloud.unparseable.slice(0, 20) });
    if (input.ledger && cloud.notInLedger.length) add({ severity: "warning", section: "cloudinary", code: "not-in-ledger", message: `${cloud.notInLedger.length} 個資料庫引用的圖片不在 Cloudinary 搬移帳本（尚未驗證上傳）。`, rows: cloud.notInLedger.slice(0, 20) });
  }

  // ── 管理員（只比對，不輸出 passwordHash） ──
  const admin: PrecheckReport["admin"] = { sqliteRows: null, bcryptLooking: null, neonRows: null, sameInNeon: null };
  const at = sqlite?.tables.get("Admin");
  if (at) {
    admin.sqliteRows = at.rows.length;
    admin.bcryptLooking = at.rows.filter((r) => typeof r.passwordHash === "string" && /^\$2[aby]\$\d{2}\$.{53}$/.test(r.passwordHash)).length;
    if (!at.rows.length) add({ severity: "blocking", section: "admin", table: "Admin", code: "no-admin", message: "SQLite 的 Admin 沒有任何管理員帳號，搬移後將無法登入後台。" });
    else if (admin.bcryptLooking !== at.rows.length) add({ severity: "warning", section: "admin", table: "Admin", code: "hash-format", message: `Admin 有 ${at.rows.length - admin.bcryptLooking} 筆的密碼雜湊格式不是常見的 bcrypt（搬移時會原樣複製，不會改動）。` });
  }
  if (pg?.tables.get("Admin")) admin.neonRows = pg.tables.get("Admin")!.count;

  // ── 條件與結論 ──
  const blocking = F.filter((f) => f.severity === "blocking");
  const conditions: Condition[] = [
    { ok: !!sqlite && sqlite.integrity.length === 1 && sqlite.integrity[0] === "ok", label: "SQLite 完整性檢查為 ok", detail: sqlite?.integrity.slice(0, 3).join("；") },
    { ok: !!sqlite && models.every((m) => sqlite.tables.has(m)), label: `SQLite 含全部 ${models.length} 個資料表` },
    { ok: !!pg && models.every((m) => pg.tables.has(m)), label: `Neon 含全部 ${models.length} 個資料表` },
    { ok: !!pg && !F.some((f) => f.section === "schema" && f.severity === "blocking"), label: "SQLite 與 Neon 的結構沒有會導致搬移失敗的差異" },
    { ok: !!pg && models.every((m) => (pg.tables.get(m)?.count ?? 0) === 0), label: "Neon 所有資料表目前都是空的" },
    { ok: !!sqlite && !F.some((f) => f.section === "data" && f.severity === "blocking"), label: "SQLite 資料沒有會導致搬移失敗的異常（空字元、整數範圍、日期、必填空值、唯一鍵重複）" },
    { ok: !!sqlite && !F.some((f) => f.code === "fk-orphan"), label: "沒有資料庫外鍵孤兒" },
    { ok: !!sqlite && !F.some((f) => f.code === "sqlite-extra-column" && f.severity === "blocking") && !F.some((f) => f.code === "sqlite-extra-table" && f.severity === "blocking"), label: "SQLite 沒有「有資料、但不會被搬移」的資料表或欄位" },
    { ok: (admin.sqliteRows ?? 0) > 0, label: "SQLite 有管理員帳號" },
    { ok: input.originalUnchanged !== false, label: "SQLite 原始檔在預檢前後完全相同（沒有被改動）" },
    { ok: !!pg && pg.readOnly === "on", label: "Neon 預檢是在唯讀交易中執行" },
  ];
  const eligible = conditions.every((c) => c.ok) && blocking.length === 0;
  return {
    generatedAt: (input.now ?? new Date()).toISOString(), sqliteIntegrity: sqlite?.integrity ?? [], models, sqliteCounts, pgCounts, sqliteTotal, pgTotal, findings: F,
    cloudinary: cloud, admin, readOnlyEvidence: [], conditions, eligible,
  };
}

// ───────────────────────── 輸出 ─────────────────────────
const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
export function countsCsv(r: PrecheckReport): string {
  return csv([["資料表", "SQLite 筆數", "Neon 筆數", "是否相同"], ...r.models.map((m) => [m, r.sqliteCounts[m] ?? "", r.pgCounts[m] ?? "", r.pgCounts[m] == null || r.sqliteCounts[m] == null ? "" : r.pgCounts[m] === r.sqliteCounts[m] ? "是" : "否"]), ["合計", r.sqliteTotal, r.pgTotal ?? "", ""]]);
}
export function findingsCsv(r: PrecheckReport): string {
  return csv([["嚴重度", "區塊", "資料表", "欄位", "代碼", "說明", "列（最多20筆，僅主鍵）"], ...r.findings.map((f) => [f.severity, f.section, f.table ?? "", f.column ?? "", f.code, f.message, (f.rows ?? []).join(" | ")])]);
}
export function reportMarkdown(r: PrecheckReport): string {
  const L: string[] = []; const p = (...s: string[]) => { L.push(...(s.length ? s : [""])); };
  const lim = (fs: Finding[]) => { if (!fs.length) { p("無。"); return; } for (const f of fs.slice(0, 60)) { p(`- **${f.severity === "blocking" ? "【阻擋】" : f.severity === "warning" ? "【警告】" : "【資訊】"}** ${f.message}${f.rows?.length ? `（例：${f.rows.slice(0, 5).join("、")}）` : ""}`); } if (fs.length > 60) p(`- …其餘 ${fs.length - 60} 項見 findings.csv`); };
  p("# SQLite → Neon PostgreSQL 搬移前預檢報告（唯讀）", "", `產生時間：${r.generatedAt}`, "", "這份預檢沒有搬移、修改任何資料；報告不含連線字串、密碼與密碼雜湊。", "");
  p(`## 結論：${r.eligible ? "✅ 符合進入正式搬移階段的條件" : "❌ 目前不符合進入正式搬移階段的條件"}`, "");
  for (const c of r.conditions) p(`- ${c.ok ? "✅" : "❌"} ${c.label}${c.detail && !c.ok ? `（${c.detail}）` : ""}`);
  const blocking = r.findings.filter((f) => f.severity === "blocking");
  if (blocking.length) { p("", `阻擋項目共 ${blocking.length} 項，見下方各區塊。`); }
  p("", "## 1. SQLite 與 Neon 各資料表筆數", "", "| 資料表 | SQLite | Neon | 相同 |", "|---|---:|---:|:---:|");
  for (const m of r.models) p(`| ${m} | ${r.sqliteCounts[m] ?? "—"} | ${r.pgCounts[m] ?? "—"} | ${r.pgCounts[m] == null || r.sqliteCounts[m] == null ? "" : r.pgCounts[m] === r.sqliteCounts[m] ? "✅" : "—"} |`);
  p(`| **合計** | **${r.sqliteTotal}** | **${r.pgTotal ?? "—"}** | |`);
  p("", "（Neon 搬移前應全部為 0；搬移後必須與 SQLite 完全相同。）");
  p("", "## 2. Schema 差異（結構、型別、可空性、主鍵、唯一、索引、外鍵）", ""); lim(r.findings.filter((f) => f.section === "schema"));
  p("", "## 3. 資料異常（空字元、整數範圍、日期、必填空值、唯一鍵重複、JSON）", ""); lim(r.findings.filter((f) => f.section === "data"));
  p("", "## 4. 外鍵與關聯孤兒（含沒有資料庫外鍵、但程式依賴的關聯）", ""); lim(r.findings.filter((f) => f.section === "relation" && f.code !== "soft-ok"));
  const ok = r.findings.filter((f) => f.code === "soft-ok"); if (ok.length) { p("", "對得上的關聯："); for (const f of ok) p(`- ✅ ${f.message}`); }
  p("", "## 5. Cloudinary 圖片路徑", "");
  p(`- 資料庫引用的 /uploads/ 圖片共 ${r.cloudinary.referencedUrls} 個；帳本顯示已驗證上傳：${r.cloudinary.verified} 個；不在帳本：${r.cloudinary.notInLedger.length} 個；路徑不合規則：${r.cloudinary.unparseable.length} 個。`);
  p(`- 帳本中有、但資料庫沒有引用：${r.cloudinary.ledgerOnlyCount} 個。帳本：${r.cloudinary.ledgerPath ? "已讀取" : "未找到"}。`); lim(r.findings.filter((f) => f.section === "cloudinary"));
  p("", "## 6. 管理員資料（只比對，不顯示雜湊）", "", `- SQLite 管理員帳號：${r.admin.sqliteRows ?? "—"} 個；密碼雜湊為 bcrypt 格式：${r.admin.bcryptLooking ?? "—"} 個。`, `- Neon 目前管理員：${r.admin.neonRows ?? "—"} 個。`); lim(r.findings.filter((f) => f.section === "admin"));
  p("", "## 7. 如何確認這次預檢沒有寫入任何東西", ""); for (const e of r.readOnlyEvidence) p(`- ${e}`);
  return L.join("\n") + "\n";
}
