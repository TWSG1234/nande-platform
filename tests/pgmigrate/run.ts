/**
 * SQLite→Neon 正式搬移工具測試（npm run test:pgmigrate）。
 * 用 sql.js 組出依真實 schema 建立的 SQLite，並以真正的暫時 PostgreSQL（embedded-postgres，只有測試用）驗證寫入、交易回滾與驗證。
 * 找不到 embedded-postgres 時，PostgreSQL 相關測試明確標示略過，不算通過。
 * 注意：Prisma 讀取路徑（prisma generate + findMany）需要 Prisma 引擎，沙盒無法下載，這裡只測 schema 轉換；請用 dry-run 在實機驗證。
 */
process.env.TZ = process.env.NANDE_TEST_TZ ?? "Asia/Taipei"; // 故意用非 UTC 時區，驗證時間不會位移
import assert from "assert";
import { execFileSync, spawnSync, execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { parsePrismaSchema, type SchemaModel } from "../../prisma/tools/pgPrecheckCore";
import { buildInserts, checkDirectUrl, checkSource, fromSqliteRaw, insertOrder, parseMigrateArgs, parsePgTimestamp, pgTimestamp, planCsv, readSqlJs, reportMarkdown, runMigration, tableHash, toSqliteReaderSchema, utcTypes, type MigrateArgs, type PgLike, type Row, type SourceData } from "../../prisma/tools/pgMigrateCore";

const P = path.resolve(__dirname, "../..") + "/";
let pass = 0, fail = 0, skipped = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };
const schemaText = fs.readFileSync(P + "prisma/schema.prisma", "utf8");
const schema = parsePrismaSchema(schemaText);
const byName = new Map(schema.map((m) => [m.name, m]));
const PGPW = "pw" + crypto.randomBytes(8).toString("hex");
const SECRET_HASH = "$2b$10$SECRETSECRETSECRETSECRETuABCDEFGHIJKLMNOPQRSTUVWXYZ01234";
const qi = (s: string) => `"${s}"`;
const SQLITE_T: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME" };
const PG_T: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "DOUBLE PRECISION", Boolean: "BOOLEAN", DateTime: "TIMESTAMP(3)" };
const RULE: Record<string, string> = { Cascade: "CASCADE", SetNull: "SET NULL", Restrict: "RESTRICT", NoAction: "NO ACTION" };
const SOFT: Record<string, Record<string, unknown>> = {
  CampusSpot: { category: "culture" }, ChineseStageAnimation: { stageId: "ChineseStage-1" }, AnnouncementLinkSet: { announcementId: "Announcement-1" },
  InfoBoxImage: { scope: "campus", boxId: "CampusSpot-1" }, PhotoSubmission: { reviewerId: null }, Admin: { passwordHash: SECRET_HASH },
};
const UNI = new Set<string>(); for (const m of schema) for (const u of m.uniques) for (const c of u) UNI.add(m.name + "." + c);
const isJson = (f: { jsonHint: string | null }) => !!f.jsonHint;

/** 每張表 2 列：第 1 列一般值；第 2 列刻意放空字串、NULL、負數、false、含毫秒的時間、特殊字元。 */
function sampleRows(): Record<string, Row[]> {
  const out: Record<string, Row[]> = {}; const done = new Set<string>();
  const visit = (m: SchemaModel) => {
    if (done.has(m.name)) return; done.add(m.name); m.relations.forEach((r) => visit(byName.get(r.refModel)!));
    const rows: Row[] = [];
    for (const n of [1, 2]) {
      const row: Row = {};
      for (const f of m.scalars) {
        const rel = m.relations.find((r) => r.fields.includes(f.name));
        if (rel) { row[f.name] = `${rel.refModel}-${UNI.has(m.name + "." + f.name) ? n : 1}`; continue; }
        const unique = UNI.has(m.name + "." + f.name) || m.id.includes(f.name);
        if (f.type === "String") row[f.name] = f.name === "id" ? `${m.name}-${n}` : unique ? `${m.name}.${f.name}.${n}` : n === 1 ? (isJson(f) ? '[{"a":"中文 \\" \\\\ 😀"}]' : `值 ${f.name} 'q' "dq" \\ \n換行 😀`) : f.optional ? null : "";
        else if (f.type === "Int") row[f.name] = n === 1 ? 7 : -5;
        else if (f.type === "Float") row[f.name] = n === 1 ? 1.5 : -0.25;
        else if (f.type === "Boolean") row[f.name] = n === 1 ? 1 : 0;
        else if (f.type === "DateTime") row[f.name] = n === 1 ? Date.UTC(2026, 5, 1, 8, 30, 15, 0) : Date.UTC(2024, 1, 29, 23, 59, 59, 123);
        if (n === 2 && f.optional && f.type !== "String" && !unique) row[f.name] = null;
      }
      Object.assign(row, SOFT[m.name] ?? {});
      if (n === 2) for (const k of ['stageId', 'announcementId']) if (m.name === 'ChineseStageAnimation' || m.name === 'AnnouncementLinkSet') if (k in row) row[k] = String(row[k]).replace(/-1$/, '-2');
      if (m.name === "Admin") row.passwordHash = SECRET_HASH;
      if (n === 2 && m.name === "Admin") row.email = "admin2@example.test";
      if (m.name === "Admin" && n === 1) row.email = "admin@example.test";
      rows.push(row);
    }
    out[m.name] = rows;
  };
  schema.forEach(visit); return out;
}
async function makeSqlite(rows = sampleRows()): Promise<Uint8Array> {
  const SQL = await require("sql.js")(); const db = new SQL.Database();
  for (const m of schema) {
    const defs = m.scalars.map((f) => `${qi(f.name)} ${SQLITE_T[f.type]}${f.optional ? "" : " NOT NULL"}`);
    defs.push(`PRIMARY KEY (${m.id.map(qi).join(", ")})`);
    for (const r of m.relations) defs.push(`FOREIGN KEY (${r.fields.map(qi).join(", ")}) REFERENCES ${qi(r.refModel)}(${r.references.map(qi).join(", ")}) ON DELETE ${RULE[r.onDelete]}`);
    db.run(`CREATE TABLE ${qi(m.name)} (${defs.join(", ")})`);
  }
  for (const m of insertOrder(schema)) for (const r of rows[m.name] ?? []) { const keys = Object.keys(r); db.run(`INSERT INTO ${qi(m.name)} (${keys.map(qi).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, keys.map((k) => r[k])); }
  const bytes = db.export(); db.close(); return bytes;
}
async function makePg(client: any) {
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  for (const m of schema) { const defs = m.scalars.map((f) => `${qi(f.name)} ${PG_T[f.type]}${f.optional ? "" : " NOT NULL"}`); defs.push(`PRIMARY KEY (${m.id.map(qi).join(", ")})`); await client.query(`CREATE TABLE ${qi(m.name)} (${defs.join(", ")})`); }
  for (const m of schema) {
    m.uniques.forEach((u, i) => client.query(`CREATE UNIQUE INDEX ${qi(`${m.name}_u${i}`)} ON ${qi(m.name)}(${u.map(qi).join(", ")})`));
    for (const r of m.relations) await client.query(`ALTER TABLE ${qi(m.name)} ADD FOREIGN KEY (${r.fields.map(qi).join(", ")}) REFERENCES ${qi(r.refModel)}(${r.references.map(qi).join(", ")}) ON DELETE ${RULE[r.onDelete]}`);
  }
  await new Promise((r) => setTimeout(r, 30));
}
const A = (o: Partial<MigrateArgs> = {}): MigrateArgs => ({ apply: false, confirm: false, expectTotal: null, verifyOnly: false, noNeon: false, ...o });
const APPLY = (n: number): MigrateArgs => A({ apply: true, confirm: true, expectTotal: n });
const total = (d: SourceData) => [...d.values()].reduce((n, r) => n + r.length, 0);
const counts = async (c: any) => Object.fromEntries(await Promise.all(schema.map(async (m) => [m.name, Number((await c.query(`SELECT COUNT(*)::int n FROM ${qi(m.name)}`)).rows[0].n)])));
const sumCounts = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const recorder = (c: any): PgLike & { log: string[] } => { const log: string[] = []; return { log, query: (sql: string, params?: unknown[]) => { log.push(sql); return c.query(sql, params); } }; };

(async () => {
  const tzOk = new Date(2026, 0, 1).getTimezoneOffset() !== 0;
  console.log(`（測試時區 TZ=${process.env.TZ}，${tzOk ? "已生效，非 UTC" : "【未生效，時區位移測試力道減弱】"}）`);
  const source = await readSqlJs(schema, await makeSqlite());

  // ───── 不需要 PostgreSQL 的測試 ─────
  await t("參數閘門：--apply 必須同時有 --confirm 與 --expect-total；乾跑不需要", () => {
    assert.deepEqual(parseMigrateArgs([]).errors, []);
    assert.deepEqual(parseMigrateArgs(["--confirm"]).errors, []);
    assert.ok(parseMigrateArgs(["--apply"]).errors.length >= 2);
    assert.ok(parseMigrateArgs(["--apply", "--confirm"]).errors.some((e) => /expect-total/.test(e)));
    assert.ok(parseMigrateArgs(["--apply", "--expect-total", "356"]).errors.some((e) => /confirm/.test(e)));
    assert.ok(parseMigrateArgs(["--apply", "--confirm", "--expect-total", "abc"]).errors.some((e) => /整數/.test(e)));
    assert.ok(parseMigrateArgs(["--apply", "--confirm", "--expect-total"]).errors.length > 0);
    assert.deepEqual(parseMigrateArgs(["--apply", "--confirm", "--expect-total", "356"]).errors, []);
    assert.equal(parseMigrateArgs(["--apply", "--confirm", "--expect-total", "356"]).args.expectTotal, 356);
    assert.ok(parseMigrateArgs(["--apply", "--confirm", "--expect-total", "1", "--verify-only"]).errors.length > 0);
    assert.ok(parseMigrateArgs(["--apply", "--confirm", "--expect-total", "1", "--no-neon"]).errors.length > 0);
  });
  await t("連線字串：只收 DIRECT_URL；沒有、格式錯、pooler 一律拒絕", () => {
    assert.ok(checkDirectUrl(undefined)); assert.ok(checkDirectUrl("mysql://x")); assert.ok(checkDirectUrl("postgresql://u:p@ep-abc-pooler.c-2.us-east-1.aws.neon.tech/db"));
    assert.equal(checkDirectUrl("postgresql://u:p@ep-abc.c-2.us-east-1.aws.neon.tech/db?sslmode=require"), null);
  });
  await t("時間：UTC 字串往返不受時區影響（含毫秒、邊界年份）", () => {
    for (const ms of [0, 1, 123, Date.UTC(2026, 5, 1, 8, 30, 15, 7), Date.UTC(2024, 1, 29, 23, 59, 59, 999), Date.UTC(9999, 11, 31, 23, 59, 59, 999), Date.UTC(1999, 0, 1, 0, 0, 0, 0)]) {
      const d = new Date(ms); assert.equal(parsePgTimestamp(pgTimestamp(d)), d.toISOString());
    }
    assert.equal(pgTimestamp(new Date(Date.UTC(2026, 5, 1, 8, 30, 15, 7))), "2026-06-01 08:30:15.007");
    assert.equal(parsePgTimestamp("2026-06-01 08:30:15"), "2026-06-01T08:30:15.000Z"); assert.equal(parsePgTimestamp("2026-06-01 08:30:15.1"), "2026-06-01T08:30:15.100Z");
  });
  await t("內容雜湊：與列順序無關；NULL≠空字串；任何一個值不同都會變；型別標記避免 1 與 '1' 混淆", () => {
    const m = byName.get("Announcement")!; const rows = source.get("Announcement")!;
    assert.equal(tableHash(m, rows), tableHash(m, [...rows].reverse()));
    const mut = (f: (r: Row) => void) => { const c = rows.map((r) => ({ ...r })); f(c[0]!); return tableHash(m, c); };
    const base = tableHash(m, rows);
    assert.notEqual(base, mut((r) => { r.titleZh = (r.titleZh as string) + " "; }));
    assert.notEqual(mut((r) => { r.image = null; }), mut((r) => { r.image = ""; }));
    assert.notEqual(base, mut((r) => { r.updatedAt = new Date((r.updatedAt as Date).getTime() + 1); }));
    assert.notEqual(base, mut((r) => { r.isPublished = !r.isPublished; }));
    assert.notEqual(base, tableHash(m, rows.slice(1)));
  });
  await t("來源讀取：SQLite 的毫秒整數時間、ISO 字串時間、0/1 布林都轉成 Prisma 形狀", () => {
    const m = byName.get("Admin")!;
    const base = Object.fromEntries(m.scalars.map((f) => [f.name, f.type === "String" ? "x" : f.type === "Int" ? 1 : f.type === "Float" ? 1 : f.type === "Boolean" ? 1 : 1780000000123])) as Row;
    const r1 = fromSqliteRaw(m, base), r2 = fromSqliteRaw(m, { ...base, createdAt: "2026-06-01T08:30:15.123Z" });
    assert.ok(r1.createdAt instanceof Date && (r1.createdAt as Date).getTime() === 1780000000123); assert.ok(r2.createdAt instanceof Date);
    const withBool = byName.get("Announcement")!; assert.equal(fromSqliteRaw(withBool, { isPublished: 0 }).isPublished, false);
  });
  await t("外鍵順序：36 張表父表在前", () => {
    const o = insertOrder(schema); assert.equal(o.length, 36); const pos = new Map(o.map((m, i) => [m.name, i]));
    for (const m of schema) for (const r of m.relations) assert.ok(pos.get(r.refModel)! < pos.get(m.name)!, `${r.refModel} 應在 ${m.name} 之前`);
  });
  await t("來源檢查：乾淨資料沒有阻擋；空字串／NULL／JSON 字串不是問題", () => {
    assert.deepEqual(checkSource(schema, source).filter((i) => i.severity === "blocking"), []);
  });
  await t("來源檢查：NUL 字元、整數溢位、必填 NULL、無效日期、孤兒外鍵 → 阻擋；軟關聯孤兒只是提醒", () => {
    const d = (): SourceData => new Map([...source].map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
    const c1 = d(); c1.get("Announcement")![0]!.titleZh = "a\u0000b"; assert.ok(checkSource(schema, c1).some((i) => i.code === "nul-char" && i.severity === "blocking"));
    const c2 = d(); c2.get("Announcement")![0]!.order = 2 ** 31; assert.ok(checkSource(schema, c2).some((i) => i.code === "int-range"));
    const c3 = d(); c3.get("Announcement")![0]!.titleZh = null; assert.ok(checkSource(schema, c3).some((i) => i.code === "null-required"));
    const c4 = d(); c4.get("Announcement")![0]!.createdAt = new Date(NaN); assert.ok(checkSource(schema, c4).some((i) => i.code === "date"));
    const c5 = d(); c5.get("LifeItem")![0]!.categoryId = "不存在"; assert.ok(checkSource(schema, c5).some((i) => i.code === "fk-orphan" && i.severity === "blocking"));
    const c6 = d(); c6.get("ChineseStageAnimation")![0]!.stageId = "不存在"; const iss = checkSource(schema, c6); assert.ok(iss.some((i) => i.code === "soft-orphan" && i.severity === "warning")); assert.ok(!iss.some((i) => i.severity === "blocking"));
    const c7 = d(); c7.get("Announcement")![0]!.order = 1.5; assert.ok(checkSource(schema, c7).some((i) => i.code === "int-range"));
  });
  await t("INSERT 產生：欄位順序、時間轉型、批次不超過參數上限、值都走參數（不拼進 SQL）", () => {
    const m = byName.get("Announcement")!; const evil = "x'); DROP TABLE \"Admin\"; --";
    const rows = Array.from({ length: 1000 }, (_, i) => ({ ...source.get("Announcement")![0]!, id: "id" + i, titleZh: evil }));
    const ins = buildInserts(m, rows);
    assert.ok(ins.length > 1); for (const q of ins) { assert.ok(q.params.length <= 30000); assert.ok(!q.sql.includes("DROP TABLE")); assert.match(q.sql, /^INSERT INTO "Announcement"/); }
    assert.equal(ins.reduce((n, q) => n + q.params.length, 0), 1000 * m.scalars.length);
    assert.match(ins[0]!.sql, /\$\d+::timestamp\(3\)/); assert.ok(ins[0]!.params.includes(evil));
    const dtIdx = m.scalars.findIndex((f) => f.type === "DateTime" && !f.optional); assert.match(String(ins[0]!.params[dtIdx]), /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}$/);
  });
  await t("Schema 轉換：換成 sqlite 唯讀 client；PostgreSQL 版 schema（directUrl、binaryTargets）也能轉；model 內容不變", () => {
    const pgStyle = schemaText.replace(/^generator client \{[\s\S]*?^\}/m, 'generator client {\n  provider = "prisma-client-js"\n  binaryTargets = ["native", "rhel-openssl-3.0.x"]\n}').replace(/^datasource db \{[\s\S]*?^\}/m, 'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}');
    assert.match(pgStyle, /directUrl/);
    for (const text of [schemaText, pgStyle]) {
      const out = toSqliteReaderSchema(text, "C:\\proj\\node_modules\\.x", "C:\\tmp\\copy.db");
      assert.equal((out.match(/^generator /gm) ?? []).length, 1); assert.equal((out.match(/^datasource /gm) ?? []).length, 1);
      assert.match(out, /provider = "sqlite"/); assert.match(out, /url\s+= "file:C:\/tmp\/copy\.db"/); assert.match(out, /output\s+= "C:\/proj\/node_modules\/\.x"/);
      assert.ok(!/postgresql|directUrl|binaryTargets|env\(/.test(out.replace(/\/\/.*$/gm, "")), "不應殘留 PostgreSQL／env 設定");
      assert.deepEqual(parsePrismaSchema(out), schema);
    }
  });
  await t("報告：不含任何欄位內容或 passwordHash，也不含連線字串", async () => {
    const rep = await runMigration({ schema, source, pg: null, args: A({ noNeon: true }) });
    const text = reportMarkdown(rep) + JSON.stringify(rep) + planCsv(rep);
    assert.ok(!text.includes("SECRETSECRET")); assert.ok(!text.includes("admin@example.test")); assert.ok(!/postgres(ql)?:\/\//.test(text)); assert.ok(!text.includes("換行"));
    assert.equal(rep.sourceTotal, 72); assert.equal(rep.plan.length, 36); assert.equal(rep.outcome, "dry-run");
  });
  await t("程式碼靜態檢查：搬移工具不含 TRUNCATE／DELETE FROM／DROP／ALTER／db push／migrate reset／seed 等指令", () => {
    for (const f of ["prisma/tools/pgMigrateCore.ts", "prisma/tools/pgMigrate.ts"]) {
      const code = fs.readFileSync(P + f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      assert.ok(!/\b(TRUNCATE|DROP\s+(TABLE|SCHEMA|DATABASE)|ALTER\s+TABLE|DELETE\s+FROM)\b/i.test(code.replace(/"[^"\n]*DROP TABLE[^"\n]*"/g, "")), f);
      assert.ok(!/db push|migrate reset|force-reset|accept-data-loss|\bseed\b|restore-life/.test(code.replace(/"[^"\n]*"/g, "").replace(/`[^`]*`/g, "")), f + " 不可呼叫會重建資料的指令");
    }
  });
  await t("CLI：--apply 缺 --confirm／--expect-total 立刻拒絕（結束碼 2），不讀 SQLite、不連線", () => {
    const tsx = P + "node_modules/tsx/dist/cli.mjs"; const dummy = path.join(os.tmpdir(), "dummy-" + process.pid + ".db"); fs.writeFileSync(dummy, "not a db");
    const run = (a: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [tsx, P + "prisma/tools/pgMigrate.ts", "--sqlite", dummy, ...a], { cwd: P, encoding: "utf8", env: { ...process.env, DIRECT_URL: "", ...env } });
    let r = run(["--apply"]); assert.equal(r.status, 2, r.stdout + r.stderr); assert.match(r.stderr, /--confirm/);
    r = run(["--apply", "--confirm"]); assert.equal(r.status, 2); assert.match(r.stderr, /--expect-total/);
    r = run(["--apply", "--confirm", "--expect-total", "72"], { DIRECT_URL: "postgresql://u:SECRETPW@ep-a-pooler.neon.tech/db" }); assert.equal(r.status, 2, r.stdout + r.stderr); assert.match(r.stderr, /pooler/); assert.ok(!(r.stdout + r.stderr).includes("SECRETPW"));
    r = run(["--apply", "--confirm", "--expect-total", "72"]); assert.equal(r.status, 2); assert.match(r.stderr, /DIRECT_URL/);
    assert.equal(fs.readFileSync(dummy, "utf8"), "not a db"); fs.unlinkSync(dummy);
  });

  // ───── PostgreSQL 側 ─────
  let EP: any = null;
  for (const dir of [P, process.env.EMBEDDED_PG_DIR ?? "/tmp/pgscratch/"]) { try { EP = (await import(path.join(dir, "node_modules/embedded-postgres/dist/index.js"))).default; break; } catch { /* 試下一個 */ } }
  if (!EP) { skipped = 12; console.log("SKIP：找不到 embedded-postgres，略過 PostgreSQL 相關的 12 項測試（不算通過）。"); }
  else {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pgdata-")); if (process.getuid?.() === 0) execSync(`chown -R postgres ${dataDir}`);
    const port = 54420 + Math.floor(Math.random() * 90);
    const server = new EP({ databaseDir: path.join(dataDir, "d"), user: "tester", password: PGPW, port, persistent: false, onLog: () => {}, onError: () => {} });
    await server.initialise(); await server.start(); await server.createDatabase("mig");
    const URL = `postgres://tester:${PGPW}@127.0.0.1:${port}/mig`;
    const pgmod = require(P + "node_modules/pg");
    const connect = async () => { const c = new pgmod.Client({ connectionString: URL, types: utcTypes(pgmod.types) }); await c.connect(); return c; };
    const client = await connect();
    try {
      const N = total(source);
      const settled = async () => { let prev = -1, same = 0; for (let i = 0; i < 20 && same < 2; i++) { await new Promise((r) => setTimeout(r, 800)); const v = await statTotal(); same = v === prev ? same + 1 : 0; prev = v; } return prev; };
      const statTotal = async () => Number((await client.query("SELECT COALESCE(SUM(n_tup_ins+n_tup_upd+n_tup_del),0)::int n FROM pg_stat_user_tables")).rows[0].n);

      await t("乾跑：只讀取，回報各表計畫筆數；Neon 仍是 0 筆", async () => {
        await makePg(client); const s0 = await settled();
        const rec = recorder(client);
        const rep = await runMigration({ schema, source, pg: rec, args: A({ expectTotal: N }) });
        assert.equal(rep.outcome, "dry-run"); assert.deepEqual(rep.refusals, []); assert.equal(rep.sourceTotal, 72); assert.ok(rep.targetChecked);
        assert.deepEqual(rep.plan.map((p) => p.rows), insertOrder(schema).map((m) => source.get(m.name)!.length));
        assert.ok(rep.plan.every((p) => p.targetRows === 0));
        assert.ok(rec.log.every((q) => /^(BEGIN READ ONLY|ROLLBACK|SELECT)/.test(q.trim())), "乾跑只能有唯讀查詢");
        assert.equal(await settled(), s0); assert.equal(sumCounts(await counts(client)), 0);
      });

      await t("正式搬移成功：筆數、每個值（含時間、空字串、NULL、JSON、特殊字元、passwordHash）逐一相同；交易內與 COMMIT 後驗證皆通過", async () => {
        await makePg(client); const rec = recorder(client);
        const rep = await runMigration({ schema, source, pg: rec, args: APPLY(N) });
        assert.equal(rep.outcome, "committed", JSON.stringify(rep.refusals) + rep.error); assert.equal(rep.insertedRows, N);
        assert.ok(rep.verification!.ok && rep.postCommitVerification!.ok);
        assert.ok(rep.verification!.tables.every((x) => x.sourceCount === x.targetCount && x.sourceHash === x.targetHash));
        assert.deepEqual(await counts(client), Object.fromEntries(schema.map((m) => [m.name, source.get(m.name)!.length])));
        // 獨立讀回（不經過工具的驗證函式）逐值比對
        const a = (await client.query(`SELECT * FROM "Announcement" ORDER BY id`)).rows, src = source.get("Announcement")!.slice().sort((x, y) => String(x.id) < String(y.id) ? -1 : 1);
        for (let i = 0; i < src.length; i++) for (const f of byName.get("Announcement")!.scalars) {
          const got = a[i][f.name], want = src[i]![f.name];
          if (f.type === "DateTime") assert.equal(want === null ? got : got, want === null ? null : (want as Date).toISOString(), f.name); else assert.deepEqual(got, want, f.name);
        }
        assert.equal((await client.query(`SELECT "passwordHash" h FROM "Admin" WHERE email='admin@example.test'`)).rows[0].h, SECRET_HASH);
        assert.equal((await client.query(`SELECT to_char("createdAt",'YYYY-MM-DD HH24:MI:SS.MS') s FROM "Announcement" WHERE id='Announcement-2'`)).rows[0].s, "2024-02-29 23:59:59.123");
        // 只送出允許的指令
        assert.ok(rec.log.every((q) => /^(BEGIN|SET LOCAL|LOCK TABLE|SELECT|INSERT INTO|COMMIT|ROLLBACK)/.test(q.trim())), rec.log.find((q) => !/^(BEGIN|SET LOCAL|LOCK TABLE|SELECT|INSERT INTO|COMMIT|ROLLBACK)/.test(q.trim())));
        assert.ok(!rec.log.some((q) => /TRUNCATE|DELETE|DROP|ALTER|UPDATE/i.test(q.replace(/"[^"]*"/g, ""))));
        assert.ok(rec.log.filter((q) => q === "BEGIN").length === 1 && rec.log.includes("COMMIT"), "只有一個寫入交易");
      });

      await t("任一張表非空 → 拒絕，Neon 原有資料原封不動、沒有新增任何列", async () => {
        await makePg(client); await client.query(`INSERT INTO "SiteSetting" (${byName.get("SiteSetting")!.scalars.map((f) => qi(f.name)).join(",")}) SELECT ${byName.get("SiteSetting")!.scalars.map((f) => f.type === "DateTime" ? "now()" : f.type === "Boolean" ? "false" : f.type === "String" ? "'x'" : "0").join(",")}`);
        const before = await counts(client);
        const rep = await runMigration({ schema, source, pg: client, args: APPLY(N) });
        assert.equal(rep.outcome, "refused"); assert.ok(rep.refusals.some((r) => r.includes("SiteSetting") && r.includes("不是空的")));
        assert.deepEqual(await counts(client), before); assert.equal(sumCounts(before), 1);
        const dry = await runMigration({ schema, source, pg: client, args: A() }); assert.equal(dry.outcome, "refused");
      });

      await t("--expect-total 與來源不符 → 拒絕且不寫入；缺資料表或欄位 → 拒絕", async () => {
        await makePg(client);
        let rep = await runMigration({ schema, source, pg: client, args: APPLY(N + 1) }); assert.equal(rep.outcome, "refused"); assert.ok(rep.refusals.some((r) => /expect-total/.test(r))); assert.equal(sumCounts(await counts(client)), 0);
        await client.query(`ALTER TABLE "Comment" DROP COLUMN "id" CASCADE`).catch(() => {}); await makePg(client); await client.query(`DROP TABLE "InfoBoxImage"`);
        rep = await runMigration({ schema, source, pg: client, args: APPLY(N) }); assert.equal(rep.outcome, "refused"); assert.ok(rep.refusals.some((r) => r.includes("InfoBoxImage")));
        await makePg(client); await client.query(`ALTER TABLE "Announcement" DROP COLUMN "titleEn"`);
        rep = await runMigration({ schema, source, pg: client, args: APPLY(N) }); assert.equal(rep.outcome, "refused"); assert.ok(rep.refusals.some((r) => r.includes("titleEn")));
      });

      await t("來源有阻擋問題 → 拒絕且不寫入（Neon 保持 0 筆）", async () => {
        await makePg(client); const bad: SourceData = new Map([...source].map(([k, v]) => [k, v.map((r) => ({ ...r }))])); bad.get("Announcement")![0]!.titleZh = "a\u0000b";
        const rep = await runMigration({ schema, source: bad, pg: client, args: APPLY(N) }); assert.equal(rep.outcome, "refused"); assert.equal(sumCounts(await counts(client)), 0);
        const diff: SourceData = new Map([...source].map(([k, v]) => [k, v.map((r) => ({ ...r }))])); diff.get("Announcement")![0]!.titleZh = "不同";
        const rep2 = await runMigration({ schema, source, crossCheck: diff, pg: client, args: APPLY(N) }); assert.equal(rep2.outcome, "refused"); assert.ok(rep2.refusals.some((r) => /不一致/.test(r))); assert.equal(sumCounts(await counts(client)), 0);
      });

      await t("寫入到一半出錯 → 整筆 ROLLBACK（36 張表仍是 0 筆）；修好後重跑成功（安全重試）", async () => {
        await makePg(client);
        for (const stage of ["before-insert", "after-insert:LifeCategory", "after-insert:Comment", "after-insert:SiteSetting", "after-verify"]) {
          const rep = await runMigration({ schema, source, pg: client, args: APPLY(N), failAt: (s) => { if (s === stage) throw new Error("模擬錯誤 " + stage); } });
          assert.equal(rep.outcome, "rolled-back", stage); assert.match(rep.error!, /模擬錯誤/); assert.equal(sumCounts(await counts(client)), 0, "回滾後必須是 0 筆：" + stage);
        }
        const retry = await runMigration({ schema, source, pg: client, args: APPLY(N) }); assert.equal(retry.outcome, "committed"); assert.equal(sumCounts(await counts(client)), N);
        const again = await runMigration({ schema, source, pg: client, args: APPLY(N) }); assert.equal(again.outcome, "refused", "已搬移後再執行必須被拒絕，不得重複寫入"); assert.equal(sumCounts(await counts(client)), N);
      });

      await t("真實資料庫錯誤（唯一鍵衝突、型別錯誤）→ ROLLBACK，且錯誤訊息不外洩密碼", async () => {
        await makePg(client); await client.query(`CREATE UNIQUE INDEX "forced_u" ON "Announcement"("titleEn")`);
        const dup: SourceData = new Map([...source].map(([k, v]) => [k, v.map((r) => ({ ...r }))])); const a = dup.get("Announcement")!; a[1]!.titleEn = a[0]!.titleEn;
        const rep = await runMigration({ schema, source: dup, pg: client, args: APPLY(N), redact: (s) => s.split(PGPW).join("[已隱藏]") });
        assert.equal(rep.outcome, "rolled-back"); assert.match(rep.error!, /unique|duplicate|重複/i); assert.equal(sumCounts(await counts(client)), 0); assert.ok(!JSON.stringify(rep).includes(PGPW));
      });

      await t("交易內驗證抓到被資料庫改動的內容（觸發器改寫值）→ ROLLBACK，不 COMMIT", async () => {
        await makePg(client);
        await client.query(`CREATE FUNCTION mangle() RETURNS trigger AS $$ BEGIN NEW."titleZh" := NEW."titleZh" || '!'; RETURN NEW; END $$ LANGUAGE plpgsql`);
        await client.query(`CREATE TRIGGER mangle_t BEFORE INSERT ON "Announcement" FOR EACH ROW EXECUTE FUNCTION mangle()`);
        const rep = await runMigration({ schema, source, pg: client, args: APPLY(N) });
        assert.equal(rep.outcome, "rolled-back"); assert.match(rep.error!, /驗證不符/); assert.ok(rep.verification && !rep.verification.ok);
        assert.ok(rep.verification!.tables.find((x) => x.table === "Announcement")!.ok === false); assert.equal(sumCounts(await counts(client)), 0);
      });

      await t("--verify-only：搬移後唯讀比對通過；被改動一個值後偵測到不符；全程不寫入", async () => {
        await makePg(client); await runMigration({ schema, source, pg: client, args: APPLY(N) });
        const s0 = await settled(); const rec = recorder(client);
        let rep = await runMigration({ schema, source, pg: rec, args: A({ verifyOnly: true, expectTotal: N }) });
        assert.equal(rep.outcome, "verify-only"); assert.ok(rep.verification!.ok); assert.ok(rec.log.every((q) => /^(BEGIN READ ONLY|ROLLBACK|SELECT)/.test(q.trim())));
        assert.equal(await settled(), s0);
        await client.query(`UPDATE "Announcement" SET "titleZh" = 'tampered' WHERE id='Announcement-1'`);
        rep = await runMigration({ schema, source, pg: client, args: A({ verifyOnly: true }) }); assert.ok(!rep.verification!.ok); assert.equal(rep.verification!.tables.filter((x) => !x.ok).map((x) => x.table).join(), "Announcement");
      });

      await t("沒有 Neon 連線／連線中斷：正式搬移拒絕；ROLLBACK 本身失敗也不丟出未處理錯誤", async () => {
        let rep = await runMigration({ schema, source, pg: null, args: APPLY(N) }); assert.equal(rep.outcome, "refused");
        await makePg(client);
        let broken = false;
        const flaky: PgLike = { query: async (sql, params) => { if (/^INSERT INTO "Comment"/.test(sql)) { broken = true; throw new Error("connection terminated"); } if (sql === "ROLLBACK" && broken) throw new Error("socket closed"); return client.query(sql, params); } };
        rep = await runMigration({ schema, source, pg: flaky, args: APPLY(N) }); assert.equal(rep.outcome, "rolled-back"); assert.match(rep.error!, /connection terminated/); assert.match(rep.error!, /ROLLBACK 也失敗/);
        await client.query("ROLLBACK").catch(() => {}); assert.equal(sumCounts(await counts(client)), 0);
      });

      await t("大量資料：5,000 列的表分批寫入、雜湊相符", async () => {
        await makePg(client); const big: SourceData = new Map([...source].map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
        const base = source.get("Announcement")![0]!; big.set("Announcement", Array.from({ length: 5000 }, (_, i) => ({ ...base, id: "big" + i, titleEn: "t" + i })));
        const n = total(big); const rep = await runMigration({ schema, source: big, pg: client, args: APPLY(n) });
        assert.equal(rep.outcome, "committed", rep.error ?? ""); assert.equal(Number((await client.query(`SELECT COUNT(*)::int n FROM "Announcement"`)).rows[0].n), 5000);
      });

      await t("鎖表中的並行寫入：不會與搬移交錯（搬移期間其他連線無法讀寫這些表）", async () => {
        await makePg(client); const other = await connect();
        try {
          let blocked = false; let sawLock = false;
          const rep = await runMigration({ schema, source, pg: client, args: APPLY(N), failAt: async (stage) => {
            if (stage === "before-insert") { sawLock = true; await other.query("SET lock_timeout='300ms'"); await other.query(`INSERT INTO "Admin" (id) VALUES ('x')`).catch((e: Error) => { blocked = /lock timeout|canceling statement/i.test(e.message); }); }
          } }); assert.equal(rep.outcome, "committed"); assert.ok(sawLock); assert.ok(blocked, "搬移交易持有鎖時，其他連線的寫入應被擋下");
        } finally { await other.end(); }
      });
    } finally { await client.end().catch(() => {}); await server.stop().catch(() => {}); fs.rmSync(dataDir, { recursive: true, force: true }); }
  }
  console.log(`\n${pass} 項通過、${fail} 項失敗${skipped ? `、${skipped} 項略過（不算通過）` : ""}`);
  process.exit(fail ? 1 : 0);
})();
