/**
 * SQLite Prisma Reader（暫存工作區）測試：npm run test:pgreader
 * Prisma 引擎在沙盒無法下載，所以「產生 Client」這一步以假的 generate 取代（產生會讀 JSON 的假 Client），
 * 其餘——暫存目錄、連結、子程序、日期還原、連線目標檢查、清除與安全防護——都是真的在跑。
 * 若設定 PRISMA_LAYOUT_PROJECT（含 prisma 與 @prisma/client 的資料夾），另外用【真的 prisma generate】驗證工作區連結配置不會觸發自動安裝。
 */
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { createWorkspace, defaultRunGenerate, linkProjectPackages, readSqliteWithPrisma, removeWorkspace, resolveTempBase, sweepStaleWorkspaces, WORKSPACE_PREFIX, type GenerateRunner } from "../../prisma/tools/pgMigrateReader";
import { toSqliteReaderSchema } from "../../prisma/tools/pgMigrateCore";

let pass = 0, fail = 0, skipped = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };
const mk = (p = "nande-rt-") => fs.mkdtempSync(path.join(os.tmpdir(), p));
const leftovers = (base: string) => fs.readdirSync(base).filter((n) => n.startsWith(WORKSPACE_PREFIX));

/** 假專案：有 node_modules/prisma 與 node_modules/@prisma/client（內含檔案，用來確認清除時不會被刪）。 */
function fakeProject() {
  const proj = mk("nande-proj-");
  for (const [d, name] of [["prisma", "prisma"], ["@prisma/client", "@prisma/client"]] as const) {
    const dir = path.join(proj, "node_modules", d); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version: "5.18.0", main: "index.js" })); fs.writeFileSync(path.join(dir, "keep.txt"), "不可被刪除");
  }
  return proj;
}
const projIntact = (proj: string) => ["prisma", "@prisma/client"].every((d) => fs.readFileSync(path.join(proj, "node_modules", d, "keep.txt"), "utf8") === "不可被刪除");

const DATA: Record<string, unknown[]> = {
  Admin: [{ id: "a1", email: "a@x", createdAt: new Date(Date.UTC(2026, 5, 1, 8, 30, 15, 123)), note: null, empty: "", flag: false, n: 0, f: -0.25 }],
  Announcement: [{ id: "n1", at: new Date(Date.UTC(2024, 1, 29, 23, 59, 59, 999)) }, { id: "n2", at: null }],
};
/** 假的「產生 Client」：寫出一個只用 Node 內建模組、行為像 PrismaClient 的 index.js；資料放在 data.json。 */
const fakeGenerate = (opt: { dbFile?: (url: string) => string; failWith?: string; needNoEnv?: boolean } = {}): GenerateRunner => (schemaFile) => {
  if (opt.failWith) return { status: 1, output: opt.failWith };
  const schema = fs.readFileSync(schemaFile, "utf8"); const out = /output\s*=\s*"([^"]+)"/.exec(schema)![1]!;
  assert.ok(/provider = "sqlite"/.test(schema) && !/postgres|env\(/.test(schema), "schema 必須是 sqlite 且不含 env／postgres");
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "data.json"), JSON.stringify(DATA, (k, v) => v));
  fs.writeFileSync(path.join(out, "index.js"), `
const fs=require("fs"),path=require("path");
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,"data.json"),"utf8"));
const rev=(v)=>Array.isArray(v)?v.map(rev):(v&&typeof v==="object")?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,(typeof x==="string"&&/^\\d{4}-\\d\\d-\\d\\dT.*Z$/.test(x))?new Date(x):rev(x)])):v;
class PrismaClient{constructor(o){this.url=o.datasources.db.url;
  if(${opt.needNoEnv ? "true" : "false"}&&(process.env.DIRECT_URL||process.env.DATABASE_URL))throw new Error("子程序不應看到 Neon 連線字串");
  for(const m of Object.keys(raw)){this[m.charAt(0).toLowerCase()+m.slice(1)]={findMany:async()=>rev(raw[m])};}}
  async $queryRawUnsafe(sql){if(sql!=="PRAGMA database_list")throw new Error("只允許唯讀 PRAGMA");return [{seq:0,name:"main",file:${opt.dbFile ? `(${opt.dbFile.toString()})(this.url)` : `this.url.replace(/^file:/,"")`}}];}
  async $disconnect(){}}
module.exports={PrismaClient};`);
  return { status: 0, output: "" };
};
const baseOpt = (base: string, proj: string, copy: string) => ({ schemaText: 'generator client {\n provider = "prisma-client-js"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n directUrl = env("DIRECT_URL")\n}\nmodel Admin {\n id String @id\n}\n', models: ["Admin", "Announcement"], copyPath: copy, projectDir: proj, tmpBase: base });

(async () => {
  await t("暫存區：建在系統 TEMP 下的獨立唯一資料夾，不在 node_modules；每次都不同；有標記檔", () => {
    const base = mk(); const a = createWorkspace(base), b = createWorkspace(base);
    assert.notEqual(a.dir, b.dir); assert.equal(path.dirname(a.dir), base); assert.ok(path.basename(a.dir).startsWith(WORKSPACE_PREFIX)); assert.ok(!a.dir.split(path.sep).includes("node_modules"));
    assert.ok(fs.existsSync(path.join(a.dir, ".nande-reader-workspace")));
    assert.equal(resolveTempBase(), path.resolve(process.env.NANDE_TEMP_DIR || os.tmpdir()));
    for (const d of [a.dir, b.dir]) assert.ok(removeWorkspace(d, base).ok);
  });
  await t("拒絕把暫存區放在 node_modules 內（含 Windows 路徑寫法）", () => {
    assert.throws(() => resolveTempBase("C:\\Users\\eno09\\proj\\node_modules\\.cache"), /node_modules/); assert.throws(() => resolveTempBase("/p/node_modules"), /node_modules/);
    assert.throws(() => createWorkspace(path.join(mk(), "node_modules")), /node_modules/);
  });
  await t("資料夾已存在：同前綴的舊資料夾不影響新建；沒有標記檔的同名前綴資料夾絕不會被清除", () => {
    const base = mk(); const old = path.join(base, WORKSPACE_PREFIX + "deadbeef"); fs.mkdirSync(old); fs.writeFileSync(path.join(old, "mine.txt"), "別人的檔案");
    const ws = createWorkspace(base); assert.notEqual(ws.dir, old);
    const r = removeWorkspace(old, base); assert.ok(!r.ok); assert.match(r.error!, /標記檔/); assert.ok(fs.existsSync(path.join(old, "mine.txt")));
    old; fs.utimesSync(old, new Date(2020, 0, 1), new Date(2020, 0, 1)); const sw = sweepStaleWorkspaces(base, 1000); assert.equal(sw.removed, 0); assert.ok(fs.existsSync(old));
    assert.ok(removeWorkspace(ws.dir, base).ok);
  });
  await t("權限不足／無法建立：回報實際路徑與原因，說明不需要系統管理員，沒有讀取任何資料", () => {
    const blocker = path.join(mk(), "iam-a-file"); fs.writeFileSync(blocker, "x");
    assert.throws(() => createWorkspace(path.join(blocker, "sub")), (e: Error) => e.message.includes(blocker) && /不需要系統管理員/.test(e.message) && /--tmp-dir/.test(e.message) && /(ENOTDIR|EEXIST|EACCES|EPERM)/.test(e.message));
    if (process.getuid?.() !== 0) { const ro = mk(); fs.chmodSync(ro, 0o500); try { assert.throws(() => createWorkspace(ro), /EACCES|EPERM/); } finally { fs.chmodSync(ro, 0o700); } }
  });
  await t("連結：只指向專案的 prisma 與 @prisma/client；清除時先移除連結，專案套件完整保留", () => {
    const base = mk(), proj = fakeProject(); const ws = createWorkspace(base); const links = linkProjectPackages(ws, proj);
    assert.equal(links.length, 2); assert.ok(links.every((l) => fs.lstatSync(l).isSymbolicLink()));
    assert.equal(fs.readFileSync(path.join(ws.dir, "node_modules", "prisma", "keep.txt"), "utf8"), "不可被刪除");
    const r = removeWorkspace(ws.dir, base); assert.ok(r.ok, r.error); assert.ok(!fs.existsSync(ws.dir)); assert.ok(projIntact(proj));
  });
  await t("清除失敗：工作區內混入連結 → 拒絕遞迴刪除並回報，連結目標完全不受影響；讀取結果仍然正確回傳", () => {
    const base = mk(), proj = fakeProject(), victim = mk("nande-victim-"); fs.writeFileSync(path.join(victim, "precious.txt"), "不可被刪除");
    const copy = path.join(mk(), "copy.db");
    const res = readSqliteWithPrisma({ ...baseOpt(base, proj, copy), runGenerate: fakeGenerate(), workspaceHook: (ws) => { fs.symlinkSync(victim, path.join(ws.dir, "evil"), "junction"); } });
    assert.equal(res.cleanup.ok, false); assert.match(res.cleanup.error!, /連結/); assert.equal(res.data.get("Admin")!.length, 1);
    assert.equal(fs.readFileSync(path.join(victim, "precious.txt"), "utf8"), "不可被刪除"); assert.ok(projIntact(proj)); assert.ok(fs.existsSync(res.workspace), "清除被拒絕時應保留資料夾供手動處理");
    // 手動處理後（移除混入的連結）可以再清掉
    fs.unlinkSync(path.join(res.workspace, "evil")); assert.ok(removeWorkspace(res.workspace, base).ok);
  });
  await t("清除安全防護：不在暫存目錄下、前綴不符、本身是連結 → 一律拒絕", () => {
    const base = mk(), other = mk(), proj = fakeProject();
    const ws = createWorkspace(other); assert.ok(!removeWorkspace(ws.dir, base).ok); removeWorkspace(ws.dir, other);
    assert.ok(!removeWorkspace(proj, base).ok); assert.ok(!removeWorkspace(path.join(base, "random"), base).ok || !fs.existsSync(path.join(base, "random")));
    const real = createWorkspace(base); const lnk = path.join(base, WORKSPACE_PREFIX + "link"); fs.symlinkSync(real.dir, lnk, "junction");
    const r = removeWorkspace(lnk, base); assert.ok(!r.ok); assert.ok(fs.existsSync(real.dir)); fs.unlinkSync(lnk); removeWorkspace(real.dir, base);
    assert.ok(projIntact(proj));
  });
  await t("完整流程：子程序讀出全部資料；日期、null、空字串、false、0、負小數原樣還原；結束後工作區已清除", () => {
    const base = mk(), proj = fakeProject(), copy = path.join(mk(), "copy.db");
    const res = readSqliteWithPrisma({ ...baseOpt(base, proj, copy), runGenerate: fakeGenerate() });
    const a = res.data.get("Admin")![0]!; assert.deepEqual(a, { id: "a1", email: "a@x", createdAt: new Date(Date.UTC(2026, 5, 1, 8, 30, 15, 123)), note: null, empty: "", flag: false, n: 0, f: -0.25 });
    assert.ok(a.createdAt instanceof Date); assert.equal(res.data.get("Announcement")!.length, 2); assert.equal((res.data.get("Announcement")![1] as any).at, null);
    assert.ok(res.cleanup.ok); assert.deepEqual(leftovers(base), []); assert.ok(projIntact(proj));
  });
  await t("連線目標：子程序看不到 DIRECT_URL／DATABASE_URL；Client 連到的不是複本時中止並清除", () => {
    const base = mk(), proj = fakeProject(), copy = path.join(mk(), "copy.db");
    process.env.DIRECT_URL = "postgresql://u:SECRETPW@ep-x.neon.tech/db"; process.env.DATABASE_URL = "postgresql://u:SECRETPW@ep-x-pooler.neon.tech/db";
    try {
      const ok = readSqliteWithPrisma({ ...baseOpt(base, proj, copy), runGenerate: fakeGenerate({ needNoEnv: true }) }); assert.equal(ok.data.get("Admin")!.length, 1);
      assert.throws(() => readSqliteWithPrisma({ ...baseOpt(base, proj, copy), runGenerate: fakeGenerate({ dbFile: () => "/somewhere/else/dev.db" }) }), /不是 SQLite 複本/);
      assert.deepEqual(leftovers(base), []);
    } finally { delete process.env.DIRECT_URL; delete process.env.DATABASE_URL; }
  });
  await t("Windows 路徑：含空白與中文、反斜線的複本路徑，產生的 schema 與傳給 Client 的 URL 都轉成正斜線且指向複本", () => {
    const win = "C:\\Users\\eno09\\AppData\\Local\\Temp\\nande-migrate-ab12\\copy.db";
    const s = toSqliteReaderSchema("model A {\n id String @id\n}\n", "C:\\Users\\eno09\\AppData\\Local\\Temp\\nande-sqlite-reader-1\\client", win);
    assert.match(s, /url\s+= "file:C:\/Users\/eno09\/AppData\/Local\/Temp\/nande-migrate-ab12\/copy\.db"/); assert.ok(!s.includes("\\"));
    const base = mk(), proj = fakeProject();
    const res = readSqliteWithPrisma({ ...baseOpt(base, proj, "C:\\Users\\eno09\\Desktop\\南得 遇見你資料\\copy.db"), runGenerate: fakeGenerate() });
    assert.equal(res.data.size, 2);
  });
  await t("Prisma generate 失敗 → 錯誤訊息帶出原因；工作區照樣清除；專案套件不受影響", () => {
    const base = mk(), proj = fakeProject();
    assert.throws(() => readSqliteWithPrisma({ ...baseOpt(base, proj, "/x/copy.db"), runGenerate: fakeGenerate({ failWith: "EPERM, Permission denied: engine" }) }), /generate.*失敗.*EPERM/s);
    assert.deepEqual(leftovers(base), []); assert.ok(projIntact(proj));
  });
  await t("重複執行：連續 3 次、再非同步交錯 3 次，各自獨立工作區，互不干擾，結束後沒有殘留", async () => {
    const base = mk(), proj = fakeProject();
    for (let i = 0; i < 3; i++) assert.equal(readSqliteWithPrisma({ ...baseOpt(base, proj, "/x/copy.db"), runGenerate: fakeGenerate() }).data.get("Admin")!.length, 1);
    const seen = new Set<string>(); const hook = (ws: { dir: string }) => { seen.add(ws.dir); };
    await Promise.all([1, 2, 3].map(async () => { await new Promise((r) => setTimeout(r, 1)); readSqliteWithPrisma({ ...baseOpt(base, proj, "/x/copy.db"), runGenerate: fakeGenerate(), workspaceHook: hook }); }));
    assert.equal(seen.size, 3); assert.deepEqual(leftovers(base), []); assert.ok(projIntact(proj));
  });
  await t("清掃舊殘留：超過時限且有標記檔的舊工作區會被清掉；新的、沒標記的不動", () => {
    const base = mk(); const old = createWorkspace(base), fresh = createWorkspace(base);
    fs.utimesSync(old.dir, new Date(2020, 0, 1), new Date(2020, 0, 1));
    const sw = sweepStaleWorkspaces(base, 3600_000); assert.equal(sw.removed, 1); assert.ok(!fs.existsSync(old.dir)); assert.ok(fs.existsSync(fresh.dir)); removeWorkspace(fresh.dir, base);
  });
  await t("原始檔不被碰：整個流程前後，複本檔位置的檔案內容與修改時間不變", () => {
    const base = mk(), proj = fakeProject(), copy = path.join(mk(), "copy.db"); fs.writeFileSync(copy, "SQLite 複本內容"); const m0 = fs.statSync(copy).mtimeMs;
    readSqliteWithPrisma({ ...baseOpt(base, proj, copy), runGenerate: fakeGenerate() }); assert.equal(fs.readFileSync(copy, "utf8"), "SQLite 複本內容"); assert.equal(fs.statSync(copy).mtimeMs, m0);
  });

  // ───── 真的 prisma generate（需要有 prisma 與 @prisma/client 的資料夾；引擎用假檔） ─────
  const layoutProj = process.env.PRISMA_LAYOUT_PROJECT;
  if (!layoutProj || !fs.existsSync(path.join(layoutProj, "node_modules", "@prisma", "client"))) { skipped = 1; console.log("SKIP：未設定 PRISMA_LAYOUT_PROJECT（需含 prisma 與 @prisma/client 的資料夾），略過『真的 prisma generate 工作區配置』1 項（不算通過）。"); }
  else await t("真的 prisma generate：工作區配置不會觸發自動安裝（暫存目錄沒有 package.json／npm 動作），產生的 Client 可從專案外載入，專案套件完整保留", () => {
    const base = mk(), fakeEngine = path.join(mk(), "fake_engine.node"); fs.writeFileSync(fakeEngine, "");
    const ws = createWorkspace(base); linkProjectPackages(ws, layoutProj);
    fs.writeFileSync(ws.schemaFile, toSqliteReaderSchema('generator client {\n provider = "prisma-client-js"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\nmodel A {\n id String @id\n}\n', ws.outDir, path.join(base, "copy.db")));
    const env = { ...process.env, PRISMA_SCHEMA_ENGINE_BINARY: "/bin/true", PRISMA_QUERY_ENGINE_LIBRARY: fakeEngine, PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1", PRISMA_GENERATE_SKIP_AUTOINSTALL: "1" };
    const g = defaultRunGenerate(ws.schemaFile, layoutProj, env); assert.equal(g.status, 0, g.output);
    assert.ok(!fs.existsSync(path.join(base, "package.json")) && !fs.existsSync(path.join(base, "node_modules")), "不應在暫存目錄安裝套件");
    assert.equal(typeof require(ws.outDir).PrismaClient, "function"); assert.ok(!/@prisma\/client/.test(fs.readFileSync(path.join(ws.outDir, "index.js"), "utf8")), "Client 不依賴專案的 @prisma/client");
    const r = removeWorkspace(ws.dir, base); assert.ok(r.ok, r.error);
    assert.ok(fs.existsSync(path.join(layoutProj, "node_modules", "@prisma", "client", "package.json")) && fs.existsSync(path.join(layoutProj, "node_modules", "prisma", "package.json")));
  });
  console.log(`\n${pass} 項通過、${fail} 項失敗${skipped ? `、${skipped} 項略過（不算通過）` : ""}`);
  process.exit(fail ? 1 : 0);
})();
