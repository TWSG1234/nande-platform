/**
 * npm run db:precheck-pg — SQLite → Neon PostgreSQL 搬移前【唯讀】預檢。不搬移、不修改任何資料。
 *
 *   npm run db:precheck-pg -- --sqlite "C:\路徑\dev.db"
 * 參數：--sqlite <dev.db 路徑>（預設：固定資料資料夾的 dev.db）  --no-neon（只檢查 SQLite，不連 Neon）
 *       --env-var <放 Neon 連線字串的環境變數，預設 DIRECT_URL，沒有就用 DATABASE_URL>
 *       --ledger <Cloudinary 搬移帳本 ledger.jsonl>  --out <報告資料夾>  --schema <schema.prisma>  --expect-total <預期總筆數>
 * 結束碼：0＝符合進入搬移階段；2＝報告已產生但不符合；1＝工具本身失敗。
 *
 * 安全：SQLite 只複製一份來讀（原檔以 SHA-256 前後比對）；Neon 只送出 SELECT／SHOW／WITH，且整個預檢在 READ ONLY 交易中；
 *       連線字串只從環境變數／.env.local 讀取，不顯示、不寫進報告；不輸出任何 passwordHash。
 */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { readConfigFile } from "../../lib/config/dataConfig";
import { readLedger } from "./uploadsMigrateCore";
import { analyze, countsCsv, findingsCsv, parsePrismaSchema, reportMarkdown, snapshotPg, snapshotSqlite, type LedgerInfo, type PgSnapshot, type SqliteSnapshot } from "./pgPrecheckCore";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(n);

function loadEnvLocal() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(#.*)?$/.exec(line);
      if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!;
    }
  }
}
const sha256File = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

/** 錯誤訊息一律先移除連線字串／密碼，再顯示。 */
function makeRedactor(urls: (string | undefined)[]) {
  const secrets: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    secrets.push(u);
    try { const x = new URL(u); if (x.password) secrets.push(x.password, decodeURIComponent(x.password)); if (x.username) secrets.push(x.username); } catch { /* 不是合法網址就只用整串比對 */ }
  }
  return (msg: string) => secrets.filter((s) => s.length >= 3).reduce((m, s) => m.split(s).join("[已隱藏]"), msg).replace(/postgres(ql)?:\/\/[^\s'"]+/gi, "[已隱藏的連線字串]");
}

function makeFreshDir(parent: string, name: string): string {
  fs.mkdirSync(parent, { recursive: true });
  for (let i = 1; i < 1000; i++) {
    const dir = path.join(parent, i === 1 ? name : `${name}-${i}`);
    try { fs.mkdirSync(dir); return dir; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  }
  throw new Error("無法建立新的報告資料夾。");
}

async function main() {
  loadEnvLocal();
  console.log("=== SQLite → Neon 搬移前預檢（唯讀，不搬移、不修改任何資料）===\n");

  // 1. 找 SQLite
  let sqlitePath = arg("--sqlite") ?? process.env.NANDE_SQLITE_PATH;
  if (!sqlitePath) {
    const dir = process.env.NANDE_DATA_DIR || readConfigFile()?.dataDir;
    if (dir) sqlitePath = path.join(dir.replace(/^["']|["']$/g, ""), "dev.db");
  }
  if (!sqlitePath) { console.error("❌ 找不到 SQLite：請加上 --sqlite \"C:\\路徑\\dev.db\"。"); process.exit(1); }
  sqlitePath = path.resolve(sqlitePath.replace(/^["']|["']$/g, ""));
  if (!fs.existsSync(sqlitePath) || !fs.statSync(sqlitePath).isFile()) { console.error("❌ 找不到 SQLite 檔案：" + sqlitePath); process.exit(1); }

  const schemaPath = path.resolve(arg("--schema") ?? path.join(process.cwd(), "prisma", "schema.prisma"));
  const schema = parsePrismaSchema(fs.readFileSync(schemaPath, "utf8"));
  if (!schema.length) { console.error("❌ 讀不到 schema 的 model：" + schemaPath); process.exit(1); }
  console.log(`SQLite：${sqlitePath}\nSchema：${schemaPath}（${schema.length} 個 model）\n`);

  // 2. 複製一份來讀；原檔前後比對
  const evidence: string[] = [];
  const before = { hash: sha256File(sqlitePath), size: fs.statSync(sqlitePath).size, mtime: fs.statSync(sqlitePath).mtimeMs };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nande-precheck-"));
  const copy = path.join(tmpDir, "copy.db");
  fs.copyFileSync(sqlitePath, copy);
  if (sha256File(copy) !== before.hash) throw new Error("複本與原檔不一致，已停止。");
  for (const side of ["-wal", "-journal"]) if (fs.existsSync(sqlitePath + side) && fs.statSync(sqlitePath + side).size > 0) console.warn(`⚠ 偵測到 ${path.basename(sqlitePath)}${side}（可能有尚未寫入主檔的資料）。請先關閉網站後重跑，或改用 db:backup 產生的備份檔。`);

  console.log("1/3 讀取 SQLite 複本…");
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(copy)));
  let sqlite: SqliteSnapshot;
  try {
    sqlite = snapshotSqlite((sql) => {
      const res = db.exec(sql);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((v: unknown[]) => Object.fromEntries(columns.map((c: string, i: number) => [c, v[i]])));
    });
  } finally { db.close(); }
  console.log(`    ${sqlite.tables.size} 張資料表`);

  // 3. Neon（唯讀）
  let pg: PgSnapshot | null = null;
  const envVar = arg("--env-var");
  const urlVar = envVar ?? (process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL");
  const url = process.env[urlVar];
  const redact = makeRedactor([process.env.DIRECT_URL, process.env.DATABASE_URL, url]);
  if (!flag("--no-neon")) {
    if (!url || !/^postgres(ql)?:\/\//i.test(url)) { console.error(`❌ 環境變數 ${urlVar} 不存在或不是 PostgreSQL 連線字串（請放在 .env.local，不要貼到對話）。只檢查 SQLite 請加 --no-neon。`); process.exit(1); }
    console.log(`2/3 連線 Neon（讀取環境變數 ${urlVar}，內容不顯示），只執行唯讀查詢…`);
    const { Client } = require("pg");
    let host = ""; try { host = new URL(url).hostname; } catch { /* ignore */ }
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 20000, statement_timeout: 30000, application_name: "nande-precheck-readonly", ...(host.includes("-pooler") ? {} : { options: "-c default_transaction_read_only=on" }) });
    try {
      await client.connect();
      await client.query("BEGIN READ ONLY");
      try { pg = await snapshotPg(async (sql) => (await client.query(sql)).rows); } finally { await client.query("ROLLBACK").catch(() => {}); await client.end().catch(() => {}); }
    } catch (e) { console.error("❌ 讀取 Neon 失敗（沒有修改任何資料）：" + redact(String((e as Error).message))); process.exit(1); }
    console.log(`    ${pg.tables.size} 張資料表`);
  } else console.log("2/3 已略過 Neon（--no-neon）");

  // 4. 原檔是否被動過
  const after = { hash: sha256File(sqlitePath), size: fs.statSync(sqlitePath).size, mtime: fs.statSync(sqlitePath).mtimeMs };
  const unchanged = before.hash === after.hash && before.size === after.size && before.mtime === after.mtime;

  // 5. Cloudinary 帳本
  const ledgerPath = path.resolve(arg("--ledger") ?? path.join(path.dirname(sqlitePath), "reports", "uploads-migrate", "ledger.jsonl"));
  let ledger: LedgerInfo | null = null;
  if (fs.existsSync(ledgerPath)) { const v = new Map<string, string>(); for (const e of readLedger(ledgerPath)) if (e.event === "verified") v.set(e.url, e.publicId); ledger = { verified: v, path: ledgerPath }; }

  console.log("3/3 分析並輸出報告…");
  const report = analyze({ schema, sqlite, pg, ledger, expectTotal: arg("--expect-total") ? Number(arg("--expect-total")) : undefined, originalUnchanged: unchanged });
  report.readOnlyEvidence = [
    `SQLite 原始檔 SHA-256 預檢前後${unchanged ? "完全相同" : "【不同！請立即確認有沒有其他程式在寫入】"}（大小 ${after.size} bytes；修改時間 ${unchanged ? "未變" : "已變"}）。`,
    `預檢實際讀取的是複製出來的暫存檔（SHA-256 與原檔相同），讀完即刪除該暫存複本；SQLite 以 sql.js 載入記憶體，沒有以寫入模式開啟任何檔案。`,
    `SQLite 共執行 ${sqlite.queryCount} 條查詢，全部通過唯讀守門（只有 SELECT 與唯讀 PRAGMA）。`,
    ...(pg ? [
      `Neon：交易唯讀狀態 transaction_read_only = ${pg.readOnly}；default_transaction_read_only = ${pg.defaultReadOnly}${host_note(url)}。`,
      `Neon 共執行 ${pg.queryCount} 條查詢，全部通過唯讀守門（只有 SELECT／SHOW／WITH），整個預檢在 BEGIN READ ONLY … ROLLBACK 之內。`,
      `Neon 寫入統計（pg_stat_user_tables 的新增＋修改＋刪除列數合計）在預檢期間前後相同：${pg.statTotal}。`,
      `預檢前後 Neon 各表筆數相同（預檢本身不會改變筆數）。`,
    ] : ["（本次未連線 Neon。）"]),
    "報告沒有任何連線字串、密碼或 passwordHash；管理員只顯示筆數與雜湊格式是否像 bcrypt。",
  ];
  const outBase = path.resolve(arg("--out") ?? path.join(path.dirname(sqlitePath), "reports"));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const outDir = makeFreshDir(outBase, `pg-precheck-${stamp}`);
  fs.writeFileSync(path.join(outDir, "report.md"), reportMarkdown(report), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "counts.csv"), countsCsv(report), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "findings.csv"), findingsCsv(report), { flag: "wx" });
  fs.rmSync(tmpDir, { recursive: true, force: true }); // 只刪除自己建立的暫存複本

  const blocking = report.findings.filter((f) => f.severity === "blocking").length, warn = report.findings.filter((f) => f.severity === "warning").length;
  console.log(`\n【結果】SQLite 合計 ${report.sqliteTotal} 筆；Neon 合計 ${report.pgTotal ?? "（未檢查）"} 筆`);
  console.log(`阻擋項目 ${blocking}｜警告 ${warn}｜${report.eligible ? "✅ 符合進入正式搬移階段" : "❌ 目前不符合進入正式搬移階段"}`);
  console.log(`SQLite 原始檔${unchanged ? "未被改動 ✅" : "【被改動了！】"}`);
  console.log(`報告：${outDir}\n（沒有搬移任何資料）`);
  process.exit(report.eligible ? 0 : 2);
}
function host_note(url: string | undefined) { try { return new URL(url!).hostname.includes("-pooler") ? "（使用的是 pooler 連線，改以 BEGIN READ ONLY 確保唯讀）" : ""; } catch { return ""; } }
main().catch((e) => { console.error("❌ 預檢失敗（沒有修改任何資料）：", String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s'"]+/gi, "[已隱藏的連線字串]")); process.exit(1); });
