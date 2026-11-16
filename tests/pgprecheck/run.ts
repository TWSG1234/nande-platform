/**
 * SQLite→Neon 預檢工具測試（npm run test:pgprecheck）。
 * 用記憶體 SQLite（sql.js）與一個真正的暫時 PostgreSQL（embedded-postgres，只有測試用，不連任何真實資料庫）。
 * 找不到 embedded-postgres 時，只跑不需要 PostgreSQL 的測試並明確標示略過，不假裝通過。
 */
import assert from "assert";
import { execFile, execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { analyze, guardReadOnlySql, parsePrismaSchema, reportMarkdown, snapshotPg, snapshotSqlite, type LedgerInfo, type SchemaModel } from "../../prisma/tools/pgPrecheckCore";

const P = path.resolve(__dirname, "../..") + "/";
let pass = 0, fail = 0, skipped = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };
const sha = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const schema = parsePrismaSchema(fs.readFileSync(P + "prisma/schema.prisma", "utf8"));
const byName = new Map(schema.map((m) => [m.name, m]));
const isJson = (f: { jsonHint: string | null }) => !!f.jsonHint;
const URL1 = `/uploads/content/${crypto.randomUUID()}.png`;
const HASH = "$2b$10$" + crypto.randomBytes(40).toString("base64").replace(/[^A-Za-z0-9]/g, "a").slice(0, 53).padEnd(53, "a");
const PGPW = "pw" + crypto.randomBytes(8).toString("hex");

// ───────── 測試資料：依 schema 自動產生「合法」的最小資料 ─────────
const SOFT_OVERRIDE: Record<string, Record<string, unknown>> = {
  CampusSpot: { category: "culture", image: URL1 }, ChineseStageAnimation: { stageId: "ChineseStage-1" }, AnnouncementLinkSet: { announcementId: "Announcement-1" },
  InfoBoxImage: { scope: "campus", boxId: "CampusSpot-1" }, PhotoSubmission: { reviewerId: null }, Admin: { passwordHash: HASH, email: "admin@example.test" }, Announcement: { image: URL1 },
};
function order(): SchemaModel[] { const done = new Set<string>(), out: SchemaModel[] = []; const visit = (m: SchemaModel) => { if (done.has(m.name)) return; done.add(m.name); for (const r of m.relations) visit(byName.get(r.refModel)!); out.push(m); }; schema.forEach(visit); return out; }
function sampleRows(): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const m of order()) {
    const row: Record<string, unknown> = {};
    for (const f of m.scalars) {
      const rel = m.relations.find((r) => r.fields.includes(f.name));
      if (rel) { row[f.name] = `${rel.refModel}-1`; continue; }
      if (f.type === "String") row[f.name] = isJson(f) ? "[]" : f.name === "id" ? `${m.name}-1` : `${m.name}.${f.name}`;
      else if (f.type === "Int") row[f.name] = 1; else if (f.type === "Float") row[f.name] = 1.5; else if (f.type === "Boolean") row[f.name] = 1; else if (f.type === "DateTime") row[f.name] = Date.UTC(2026, 5, 1);
    }
    Object.assign(row, SOFT_OVERRIDE[m.name] ?? {});
    out[m.name] = [row];
  }
  return out;
}
const qi = (s: string) => `"${s}"`;
const SQLITE_T: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME" };
const PG_T: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "DOUBLE PRECISION", Boolean: "BOOLEAN", DateTime: "TIMESTAMP(3)" };
const RULE: Record<string, string> = { Cascade: "CASCADE", SetNull: "SET NULL", Restrict: "RESTRICT", NoAction: "NO ACTION" };

interface SqliteOpt { skipUnique?: boolean; dropColumn?: [string, string]; extraTable?: boolean; extraColumn?: [string, string]; rows?: Record<string, Record<string, unknown>[]>; mutate?: (db: any) => void }
async function makeSqlite(opt: SqliteOpt = {}): Promise<Uint8Array> {
  const SQL = await require("sql.js")(); const db = new SQL.Database();
  for (const m of schema) {
    const cols = m.scalars.filter((f) => !(opt.dropColumn && opt.dropColumn[0] === m.name && opt.dropColumn[1] === f.name));
    const defs = cols.map((f) => `${qi(f.name)} ${SQLITE_T[f.type]}${f.optional ? "" : " NOT NULL"}`);
    if (opt.extraColumn && opt.extraColumn[0] === m.name) defs.push(`${qi(opt.extraColumn[1])} TEXT`);
    defs.push(`PRIMARY KEY (${m.id.map(qi).join(", ")})`);
    for (const r of m.relations) defs.push(`FOREIGN KEY (${r.fields.map(qi).join(", ")}) REFERENCES ${qi(r.refModel)}(${r.references.map(qi).join(", ")}) ON DELETE ${RULE[r.onDelete]}`);
    db.run(`CREATE TABLE ${qi(m.name)} (${defs.join(", ")})`);
    if (!opt.skipUnique) m.uniques.forEach((u, i) => db.run(`CREATE UNIQUE INDEX ${qi(`${m.name}_u${i}`)} ON ${qi(m.name)}(${u.map(qi).join(", ")})`));
    m.indexes.forEach((u, i) => db.run(`CREATE INDEX ${qi(`${m.name}_i${i}`)} ON ${qi(m.name)}(${u.map(qi).join(", ")})`));
  }
  if (opt.extraTable) { db.run(`CREATE TABLE "LegacyStuff" ("id" TEXT PRIMARY KEY, "note" TEXT)`); db.run(`INSERT INTO "LegacyStuff" VALUES ('1', 'x')`); }
  const rows = opt.rows ?? sampleRows();
  for (const m of order()) for (const r of rows[m.name] ?? []) {
    const keys = Object.keys(r).filter((k) => !(opt.dropColumn && opt.dropColumn[0] === m.name && opt.dropColumn[1] === k));
    db.run(`INSERT INTO ${qi(m.name)} (${keys.map(qi).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, keys.map((k) => r[k]));
  }
  if (opt.extraColumn) db.run(`UPDATE ${qi(opt.extraColumn[0])} SET ${qi(opt.extraColumn[1])} = 'legacy data'`);
  opt.mutate?.(db);
  const bytes = db.export(); db.close(); return bytes;
}
const sqliteSnap = async (bytes: Uint8Array) => { const SQL = await require("sql.js")(); const db = new SQL.Database(bytes);
  try { return snapshotSqlite((sql) => { const r = db.exec(sql); if (!r.length) return []; return r[0].values.map((v: unknown[]) => Object.fromEntries(r[0].columns.map((c: string, i: number) => [c, v[i]]))); }); } finally { db.close(); } };

interface PgOpt { dropColumn?: [string, string]; dropTable?: string; typeOverride?: [string, string, string]; notNullOptional?: boolean; noFks?: boolean; insertSample?: boolean }
async function makePg(client: any, opt: PgOpt = {}) {
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  for (const m of schema) {
    if (opt.dropTable === m.name) continue;
    const defs = m.scalars.filter((f) => !(opt.dropColumn && opt.dropColumn[0] === m.name && opt.dropColumn[1] === f.name)).map((f) => {
      let type = PG_T[f.type]; if (opt.typeOverride && opt.typeOverride[0] === m.name && opt.typeOverride[1] === f.name) type = opt.typeOverride[2];
      return `${qi(f.name)} ${type}${f.optional && !opt.notNullOptional ? "" : " NOT NULL"}`;
    });
    defs.push(`PRIMARY KEY (${m.id.map(qi).join(", ")})`);
    await client.query(`CREATE TABLE ${qi(m.name)} (${defs.join(", ")})`);
  }
  for (const m of schema) {
    if (opt.dropTable === m.name) continue;
    m.uniques.forEach((u, i) => client.query(`CREATE UNIQUE INDEX ${qi(`${m.name}_u${i}`)} ON ${qi(m.name)}(${u.map(qi).join(", ")})`));
    m.indexes.forEach((u, i) => client.query(`CREATE INDEX ${qi(`${m.name}_i${i}`)} ON ${qi(m.name)}(${u.map(qi).join(", ")})`));
    if (!opt.noFks) for (const r of m.relations) if (opt.dropTable !== r.refModel) await client.query(`ALTER TABLE ${qi(m.name)} ADD FOREIGN KEY (${r.fields.map(qi).join(", ")}) REFERENCES ${qi(r.refModel)}(${r.references.map(qi).join(", ")}) ON DELETE ${RULE[r.onDelete]}`);
  }
  await new Promise((r) => setTimeout(r, 30));
}
const pgSnap = async (client: any) => { await client.query("BEGIN READ ONLY"); try { return await snapshotPg(async (sql) => (await client.query(sql)).rows); } finally { await client.query("ROLLBACK"); } };
const ledgerOf = (urls: string[]): LedgerInfo => ({ verified: new Map(urls.map((u) => [u, "nande-platform/x"])), path: "ledger.jsonl" });
const codes = (r: ReturnType<typeof analyze>, sev?: string) => r.findings.filter((f) => !sev || f.severity === sev).map((f) => f.code);

(async () => {
  await t("schema 解析：37 個 model、8 組外鍵、複合規則；JSON 欄位由註解判斷", () => {
    assert.equal(schema.length, 37); assert.equal(schema.reduce((n, m) => n + m.relations.length, 0), 8);
    assert.deepEqual(byName.get("AnnouncementLinkSet")!.id, ["announcementId"]); assert.ok(byName.get("Admin")!.uniques.some((u) => u.join() === "email"));
    assert.ok(byName.get("ChinesePage")!.scalars.some((f) => f.name === "comicImages" && isJson(f)));
    assert.equal(byName.get("ChineseLevel")!.relations[0]!.onDelete, "Cascade"); assert.equal(byName.get("AssistantKnowledge")!.relations[0]!.onDelete, "SetNull");
  });
  await t("唯讀守門：只放行 SELECT／SHOW／WITH／唯讀 PRAGMA；寫入、DDL、多語句一律拒絕", () => {
    for (const ok of ["SELECT 1", "show transaction_read_only", "WITH a AS (SELECT 1) SELECT * FROM a", "PRAGMA table_info(\"X\")", "SELECT COUNT(*) FROM \"Admin\";"]) guardReadOnlySql(ok);
    for (const bad of ["INSERT INTO a VALUES (1)", "UPDATE a SET b=1", "DELETE FROM a", "TRUNCATE a", "DROP TABLE a", "ALTER TABLE a ADD b", "CREATE TABLE a(b)", "SELECT 1; DELETE FROM a", "WITH x AS (DELETE FROM a RETURNING *) SELECT * FROM x", "PRAGMA writable_schema=1", "COPY a FROM STDIN", "VACUUM"]) assert.throws(() => guardReadOnlySql(bad), /只允許|不允許|拒絕/, bad);
  });

  // ───── SQLite 側（不需要 PostgreSQL） ─────
  const clean = await sqliteSnap(await makeSqlite());
  await t("SQLite 乾淨資料：完整性 ok、37 表各 1 筆、沒有資料異常；原始位元組不被改動", async () => {
    const bytes = await makeSqlite(); const h = crypto.createHash("sha256").update(bytes).digest("hex"); await sqliteSnap(bytes); assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), h);
    assert.deepEqual(clean.integrity, ["ok"]); assert.equal(clean.tables.size, 37);
    const r = analyze({ schema, sqlite: clean, pg: null, ledger: ledgerOf([URL1]) });
    assert.equal(r.sqliteTotal, 37); assert.deepEqual(codes(r, "blocking"), []); assert.deepEqual(codes(r, "warning"), []);
    assert.equal(r.cloudinary.referencedUrls, 1); assert.equal(r.cloudinary.verified, 1);
  });
  const withData = async (mutate: (db: any) => void, ledger = ledgerOf([URL1])) => analyze({ schema, sqlite: await sqliteSnap(await makeSqlite({ mutate })), pg: null, ledger });
  await t("資料異常偵測：空字元、整數超出範圍、日期異常、必填空值、布林異常、文字欄位存了二進位資料", async () => {
    const r = await withData((db) => {
      db.run(`UPDATE "Announcement" SET "titleZh" = 'a' || char(0) || 'b'`); // 注意：SQLite 內部可存空字元
      db.run(`UPDATE "ChineseStage" SET "order" = 3000000000`); db.run(`UPDATE "CalendarEvent" SET "createdAt" = 'not a date'`);
      db.run(`UPDATE "Announcement" SET "isPublished" = 5`);
      db.run(`UPDATE "LifeCategory" SET "nameZh" = x'0102'`);
    });
    const c = codes(r, "blocking");
    for (const code of ["int-range", "bad-date", "not-bool", "not-text"]) assert.ok(c.includes(code), code + " / " + c.join());
  });
  await t("空字元：含 \\0 的文字被標為阻擋（PostgreSQL 不接受）", async () => {
    const r = await withData((db) => db.run(`UPDATE "Announcement" SET "titleZh" = 'a' || char(0) || 'b'`)); assert.ok(r.findings.some((f) => f.code === "nul-char" && f.table === "Announcement"), codes(r).join());
  });
  await t("必填欄位出現空值 → 阻擋", async () => {
    const bytes = await makeSqlite({ rows: (() => { const x = sampleRows(); x.Admin![0]!.email = null; return x; })() }).catch(() => null);
    // 以 NOT NULL 建表會直接拒絕寫入 → 改用「去掉 NOT NULL」的情境由 schema 不一致偵測；這裡驗證資料掃描本身：
    const snap = await sqliteSnap(await makeSqlite()); snap.tables.get("Admin")!.rows[0]!.email = null;
    assert.ok(analyze({ schema, sqlite: snap, pg: null, ledger: ledgerOf([URL1]) }).findings.some((f) => f.code === "null-in-required" && f.table === "Admin")); void bytes;
  });
  await t("唯一鍵重複、外鍵孤兒、沒有外鍵的關聯孤兒（stageId／categoryId／boxId／announcementId）", async () => {
    const snapU = await sqliteSnap(await makeSqlite()); const admin = snapU.tables.get("Admin")!; admin.rows.push({ ...admin.rows[0]!, id: "Admin-2" });
    assert.ok(analyze({ schema, sqlite: snapU, pg: null, ledger: ledgerOf([URL1]) }).findings.some((f) => f.code === "unique-duplicate" && f.table === "Admin"));
    const r = await withData((db) => {
      db.run(`UPDATE "LifeItem" SET "categoryId" = 'nope'`); db.run(`UPDATE "ChineseLevel" SET "categoryId" = 'nope'`);
      db.run(`UPDATE "ChineseStageAnimation" SET "stageId" = 'ghost-stage'`); db.run(`UPDATE "CampusSpot" SET "category" = 'ghost-cat'`);
      db.run(`UPDATE "InfoBoxImage" SET "boxId" = 'ghost-box'`); db.run(`UPDATE "AnnouncementLinkSet" SET "announcementId" = 'ghost-a'`);
    });
    const orph = r.findings.filter((f) => f.code === "fk-orphan").map((f) => f.table); assert.ok(orph.includes("LifeItem") && orph.includes("ChineseLevel"));
    const soft = r.findings.filter((f) => f.code === "soft-orphan").map((f) => `${f.table}.${f.column}`); for (const k of ["ChineseStageAnimation.stageId", "CampusSpot.category", "InfoBoxImage.boxId", "AnnouncementLinkSet.announcementId"]) assert.ok(soft.includes(k), k + " / " + soft.join());
    assert.equal(r.findings.find((f) => f.code === "soft-orphan")!.severity, "warning");
  });
  await t("CampusSpot.category 使用預設分類 culture／school_units 且分類表是空的 → 不算孤兒", async () => {
    const r = await withData(() => {}); assert.ok(!r.findings.some((f) => f.code === "soft-orphan")); assert.ok(r.findings.some((f) => f.code === "soft-ok" && f.table === "CampusSpot"));
  });
  await t("JSON 字串欄位：無法解析 → 警告；空字串不算錯", async () => {
    const r = await withData((db) => { db.run(`UPDATE "ChinesePage" SET "comicImages" = '{oops'`); db.run(`UPDATE "ChinesePage" SET "comicImagesEn" = ''`); });
    assert.ok(r.findings.some((f) => f.code === "bad-json" && f.column === "comicImages")); assert.ok(!r.findings.some((f) => f.code === "bad-json" && f.column === "comicImagesEn"));
  });
  await t("SQLite 結構：缺欄位（舊版資料庫）、多出來且有資料的欄位／資料表 → 阻擋", async () => {
    const miss = analyze({ schema, sqlite: await sqliteSnap(await makeSqlite({ dropColumn: ["Announcement", "titleEn"] })), pg: null, ledger: ledgerOf([URL1]) }); assert.ok(codes(miss, "blocking").includes("sqlite-missing-column"));
    const ex = analyze({ schema, sqlite: await sqliteSnap(await makeSqlite({ extraColumn: ["Announcement", "legacyNote"], extraTable: true })), pg: null, ledger: ledgerOf([URL1]) });
    assert.ok(ex.findings.some((f) => f.code === "sqlite-extra-column" && f.severity === "blocking")); assert.ok(ex.findings.some((f) => f.code === "sqlite-extra-table" && f.severity === "blocking"));
  });
  await t("Cloudinary 圖片路徑：帳本沒有的、規則不合的路徑 → 警告；帳本多出的只計數", async () => {
    const r = analyze({ schema, sqlite: clean, pg: null, ledger: ledgerOf(["/uploads/content/other.png"]) });
    assert.deepEqual(r.cloudinary.notInLedger, [URL1]); assert.equal(r.cloudinary.ledgerOnlyCount, 1); assert.ok(codes(r, "warning").includes("not-in-ledger"));
    const bad = analyze({ schema, sqlite: await sqliteSnap(await makeSqlite({ mutate: (db) => db.run(`UPDATE "Announcement" SET "image" = '/uploads/a.php'`) })), pg: null, ledger: ledgerOf([]) });
    assert.deepEqual(bad.cloudinary.unparseable, ["/uploads/a.php"]);
    assert.ok(codes(analyze({ schema, sqlite: clean, pg: null, ledger: null }), "warning").includes("no-ledger"));
  });
  await t("管理員：只回報筆數與雜湊格式；沒有管理員 → 阻擋；報告文字不含 passwordHash 與 email", async () => {
    const r = analyze({ schema, sqlite: clean, pg: null, ledger: ledgerOf([URL1]) }); assert.equal(r.admin.sqliteRows, 1); assert.equal(r.admin.bcryptLooking, 1);
    const text = reportMarkdown(r) + JSON.stringify(r); assert.ok(!text.includes(HASH) && !text.includes("admin@example.test"));
    const none = analyze({ schema, sqlite: await sqliteSnap(await makeSqlite({ mutate: (db) => db.run(`DELETE FROM "Admin"`) })), pg: null, ledger: ledgerOf([URL1]) }); assert.ok(codes(none, "blocking").includes("no-admin"));
  });

  // ───── PostgreSQL 側（需要 embedded-postgres） ─────
  let EP: any = null;
  for (const dir of [P, process.env.EMBEDDED_PG_DIR ?? "/tmp/pgscratch/"]) { try { EP = (await import(path.join(dir, "node_modules/embedded-postgres/dist/index.js"))).default; break; } catch { /* 試下一個 */ } }
  if (!EP) { skipped = 8; console.log("SKIP：找不到 embedded-postgres，略過 PostgreSQL 相關的 8 項測試（不算通過）。可設定 EMBEDDED_PG_DIR 指向裝有 embedded-postgres 的資料夾。"); }
  else {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pgdata-")); if (process.getuid?.() === 0) execSync(`chown -R postgres ${dataDir}`);
    const port = 54330 + Math.floor(Math.random() * 90);
    const server = new EP({ databaseDir: path.join(dataDir, "d"), user: "tester", password: PGPW, port, persistent: false, onLog: () => {}, onError: () => {} });
    await server.initialise(); await server.start(); await server.createDatabase("pre");
    const URL = `postgres://tester:${PGPW}@127.0.0.1:${port}/pre`;
    const pg = require(P + "node_modules/pg"); const client = new pg.Client({ connectionString: URL }); await client.connect();
    const sqliteOk = await sqliteSnap(await makeSqlite());
    const run = async (o: PgOpt = {}, sq = sqliteOk) => { await makePg(client, o); return analyze({ schema, sqlite: sq, pg: await pgSnap(client), ledger: ledgerOf([URL1]) }); };
    try {
      await t("Neon（乾淨）：37 表都在、全空、結構一致 → 符合進入搬移階段；唯讀交易 on、寫入統計前後相同", async () => {
        await makePg(client); const snap = await pgSnap(client); const r = analyze({ schema, sqlite: sqliteOk, pg: snap, ledger: ledgerOf([URL1]) });
        assert.equal(snap.readOnly, "on"); assert.equal(snap.tables.size, 37); assert.equal(r.pgTotal, 0); assert.deepEqual(codes(r, "blocking"), [], codes(r).join()); assert.equal(r.eligible, true, JSON.stringify(r.conditions.filter((c) => !c.ok)));
        assert.ok(r.pgTotal === 0 && r.sqliteTotal === 37);
      });
      await t("Neon 結構差異：缺資料表／缺欄位／型別不同／NOT NULL 與 schema 不同 → 阻擋；缺外鍵 → 警告", async () => {
        assert.ok(codes(await run({ dropTable: "Partner" }), "blocking").includes("pg-missing-table"));
        const mc = await run({ dropColumn: ["Announcement", "titleEn"] }); assert.ok(codes(mc, "blocking").includes("pg-missing-column")); assert.ok(mc.findings.some((f) => f.code === "data-without-target" || f.code === "pg-missing-column"));
        assert.ok(codes(await run({ typeOverride: ["ChineseStage", "order", "BIGINT"] }), "blocking").includes("pg-type"));
        assert.ok(codes(await run({ notNullOptional: true }), "blocking").includes("pg-notnull"));
        const nf = await run({ noFks: true }); assert.ok(codes(nf, "warning").includes("pg-missing-fk")); assert.equal(nf.findings.some((f) => f.code === "pg-missing-fk" && f.severity === "blocking"), false);
      });
      await t("SQLite 有資料、Neon 沒有對應欄位 → 明確列為阻擋（data-without-target）", async () => {
        const sq = await sqliteSnap(await makeSqlite()); const r = await run({ dropColumn: ["CampusSpot", "descriptionEn"] }, sq);
        assert.ok(r.findings.some((f) => f.code === "data-without-target" && f.table === "CampusSpot" && f.severity === "blocking")); assert.equal(r.eligible, false);
      });
      await t("Neon 不是空的 → 阻擋，結論為不符合", async () => {
        await makePg(client); await client.query(`INSERT INTO "Partner" ("id","name","logo","websiteUrl","order","isPublished","createdAt","updatedAt") VALUES ('p','n','','',0,true,now(),now())`.replace(/"logo",|'',(?=')/g, (m) => m)).catch(() => {});
        const cnt = Number((await client.query(`SELECT COUNT(*)::int AS n FROM "Partner"`)).rows[0].n);
        if (!cnt) { await client.query(`INSERT INTO "Admin" ("id","email","passwordHash","createdAt","updatedAt") VALUES ('a','e','h',now(),now())`); }
        const r = analyze({ schema, sqlite: sqliteOk, pg: await pgSnap(client), ledger: ledgerOf([URL1]) }); assert.ok(codes(r, "blocking").includes("pg-not-empty")); assert.equal(r.eligible, false);
      });
      await t("預檢不會改變 Neon：執行前後各表筆數與寫入統計相同（預檢使用的連線是唯讀的）", async () => {
        await makePg(client); const before = await pgSnap(client); await pgSnap(client); await pgSnap(client); const after = await pgSnap(client);
        assert.equal(after.statTotal, before.statTotal); assert.deepEqual([...after.tables].map(([k, v]) => [k, v.count]), [...before.tables].map(([k, v]) => [k, v.count]));
        await assert.rejects(snapshotPg(async (sql) => (await client.query(sql.replace(/^SELECT table_name/, "DROP TABLE x --"))).rows)); // 守門在送出前就拒絕
      });
      await t("唯讀交易本身會擋下寫入（資料庫層保護）：READ ONLY 交易內嘗試寫入會被 PostgreSQL 拒絕", async () => {
        await makePg(client); await client.query("BEGIN READ ONLY");
        await assert.rejects(client.query(`INSERT INTO "Admin" ("id","email","passwordHash","createdAt","updatedAt") VALUES ('a','e','h',now(),now())`), /read-only transaction/);
        await client.query("ROLLBACK"); assert.equal(Number((await client.query(`SELECT COUNT(*)::int AS n FROM "Admin"`)).rows[0].n), 0);
      });

      // ───── 命令列（實際啟動 db:precheck-pg） ─────
      const work = fs.mkdtempSync(path.join(os.tmpdir(), "precheck-cli-")); const dbFile = path.join(work, "dev.db"); fs.writeFileSync(dbFile, await makeSqlite());
      fs.mkdirSync(path.join(work, "reports", "uploads-migrate"), { recursive: true }); fs.writeFileSync(path.join(work, "reports", "uploads-migrate", "ledger.jsonl"), JSON.stringify({ event: "verified", url: URL1, publicId: "nande-platform/x", sha256: "0", size: 1, ts: "", runId: "r" }) + "\n");
      const cli = (args: string[], env: Record<string, string>) => new Promise<{ code: number; out: string }>((resolve) => {
        const e: NodeJS.ProcessEnv = { ...process.env, ...env }; delete e.NANDE_DATA_DIR;
        execFile(P + "node_modules/.bin/tsx", [P + "prisma/tools/pgPrecheck.ts", ...args], { cwd: P, env: e, timeout: 120000 }, (err, so, se) => resolve({ code: err ? ((err as any).code ?? 1) : 0, out: so + se }));
      });
      await makePg(client);
      const hashBefore = sha(dbFile); const statBefore = fs.statSync(dbFile).mtimeMs;
      await t("CLI 全流程：符合條件 → 結束碼 0；產生 report.md／report.json／counts.csv／findings.csv；SQLite 原檔未變；輸出與報告不含連線字串、密碼、雜湊", async () => {
        const r = await cli(["--sqlite", dbFile], { DIRECT_URL: URL }); assert.equal(r.code, 0, r.out);
        const repDir = path.join(work, "reports", fs.readdirSync(path.join(work, "reports")).find((d) => d.startsWith("pg-precheck-"))!);
        for (const f of ["report.md", "report.json", "counts.csv", "findings.csv"]) assert.ok(fs.existsSync(path.join(repDir, f)), f);
        const all = r.out + fs.readdirSync(repDir).map((f) => fs.readFileSync(path.join(repDir, f), "utf8")).join("\n");
        for (const secret of [PGPW, URL, HASH, "admin@example.test", `127.0.0.1:${port}`]) assert.ok(!all.includes(secret), "洩漏：" + secret.slice(0, 6));
        assert.match(fs.readFileSync(path.join(repDir, "report.md"), "utf8"), /符合進入正式搬移階段/); assert.match(r.out, /未被改動/);
        assert.equal(sha(dbFile), hashBefore); assert.equal(fs.statSync(dbFile).mtimeMs, statBefore);
        assert.equal(Number((await client.query(`SELECT COUNT(*)::int AS n FROM "Admin"`)).rows[0].n), 0, "Neon 不可有任何新資料");
      });
      await t("CLI：連線失敗（密碼錯誤）→ 結束碼 1，錯誤訊息不含密碼與連線字串", async () => {
        const bad = `postgres://tester:wrong${PGPW}@127.0.0.1:${port}/pre`; const r = await cli(["--sqlite", dbFile], { DIRECT_URL: bad }); assert.equal(r.code, 1, r.out);
        assert.ok(!r.out.includes(`wrong${PGPW}`) && !r.out.includes(bad));
      });
      await t("CLI：Neon 非空 → 報告仍產生但結束碼 2（不符合）；--no-neon 只檢查 SQLite", async () => {
        await client.query(`INSERT INTO "Admin" ("id","email","passwordHash","createdAt","updatedAt") VALUES ('a','e','h',now(),now())`);
        const r = await cli(["--sqlite", dbFile], { DIRECT_URL: URL }); assert.equal(r.code, 2, r.out); assert.match(r.out, /不符合/);
        await client.query(`DELETE FROM "Admin"`); const r2 = await cli(["--sqlite", dbFile, "--no-neon"], {}); assert.equal(r2.code, 2); assert.match(r2.out, /略過 Neon/);
        assert.equal(sha(dbFile), hashBefore);
      });
      fs.rmSync(work, { recursive: true, force: true });
    } finally { await client.end().catch(() => {}); await server.stop().catch(() => {}); fs.rmSync(dataDir, { recursive: true, force: true }); }
  }
  console.log(`\n${pass} 項通過，${fail} 項失敗${skipped ? `，${skipped} 項略過（沒有 PostgreSQL 測試環境）` : ""}`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
