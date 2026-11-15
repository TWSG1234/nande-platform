/**
 * npm run db:migrate-to-pg — SQLite → Neon PostgreSQL 正式資料搬移工具。
 *
 *   乾跑（預設，不寫入）：  npm run db:migrate-to-pg -- --sqlite "C:\路徑\dev.db"
 *   正式搬移：              npm run db:migrate-to-pg -- --sqlite "C:\路徑\dev.db" --apply --confirm --expect-total 356
 *   事後唯讀比對：          npm run db:migrate-to-pg -- --sqlite "C:\路徑\dev.db" --verify-only
 * 其他：--tmp-dir <暫存資料夾，預設系統 TEMP>  --out <報告資料夾>  --schema <schema.prisma>  --no-neon（乾跑時不連 Neon）
 * 結束碼：0＝乾跑可進入正式搬移／已搬移並驗證通過；2＝被拒絕（沒有寫入）；1＝失敗（已回滾，或工具本身錯誤）。
 *
 * 安全：從 SQLite【複本】讀（原檔 SHA-256／大小／修改時間前後比對）；寫入只用 DIRECT_URL（拒絕 pooler）；
 *       單一交易、任何錯誤完整回滾；Neon 任一表非空即拒絕；從不 TRUNCATE／DELETE；不碰 .env.local、Cloudinary、Google Drive、網站程式。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { readConfigFile } from "../../lib/config/dataConfig";
import { parsePrismaSchema } from "./pgPrecheckCore";
import { readSqliteWithPrisma, resolveTempBase, sweepStaleWorkspaces } from "./pgMigrateReader";
import { checkDirectUrl, parseMigrateArgs, planCsv, readSqlJs, reportMarkdown, runMigration, toSqliteReaderSchema, utcTypes, type SourceData } from "./pgMigrateCore";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };

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
function makeRedactor(urls: (string | undefined)[]) {
  const secrets: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    secrets.push(u);
    try { const x = new URL(u); if (x.password) secrets.push(x.password, decodeURIComponent(x.password)); if (x.username) secrets.push(x.username); } catch { /* 只用整串比對 */ }
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
  const { args, errors } = parseMigrateArgs(process.argv.slice(2));
  console.log("=== SQLite → Neon 資料搬移工具 ===");
  if (errors.length) { console.error("⛔ 參數不完整，未讀取也未寫入任何資料：\n" + errors.map((e) => "  - " + e).join("\n")); process.exit(2); }
  console.log(args.apply ? "模式：【正式搬移】" : args.verifyOnly ? "模式：唯讀驗證（--verify-only）" : "模式：乾跑 dry-run（不寫入任何資料；正式搬移需 --apply --confirm --expect-total N）");
  loadEnvLocal();

  let sqlitePath = arg("--sqlite") ?? process.env.NANDE_SQLITE_PATH;
  if (!sqlitePath) { const dir = process.env.NANDE_DATA_DIR || readConfigFile()?.dataDir; if (dir) sqlitePath = path.join(dir.replace(/^["']|["']$/g, ""), "dev.db"); }
  if (!sqlitePath) { console.error("❌ 找不到 SQLite：請加上 --sqlite \"C:\\路徑\\dev.db\"。"); process.exit(1); }
  sqlitePath = path.resolve(sqlitePath.replace(/^["']|["']$/g, ""));
  if (!fs.existsSync(sqlitePath) || !fs.statSync(sqlitePath).isFile()) { console.error("❌ 找不到 SQLite 檔案：" + sqlitePath); process.exit(1); }
  const schemaPath = path.resolve(arg("--schema") ?? path.join(process.cwd(), "prisma", "schema.prisma"));
  const schemaText = fs.readFileSync(schemaPath, "utf8");
  const schema = parsePrismaSchema(schemaText);
  if (!schema.length) { console.error("❌ 讀不到 schema 的 model：" + schemaPath); process.exit(1); }

  const url = process.env.DIRECT_URL;
  const redact = makeRedactor([process.env.DIRECT_URL, process.env.DATABASE_URL]);
  const preRefusals: string[] = [];
  for (const side of ["-wal", "-journal"]) if (fs.existsSync(sqlitePath + side) && fs.statSync(sqlitePath + side).size > 0) preRefusals.push(`偵測到 ${path.basename(sqlitePath)}${side}（有尚未寫入主檔的資料）。請先關閉網站／其他程式後再執行，避免複本少資料。`);
  let urlProblem: string | null = null;
  if (!args.noNeon) { urlProblem = checkDirectUrl(url); if (urlProblem && (args.apply || args.verifyOnly || url)) preRefusals.push(urlProblem); }

  if ((args.apply || args.verifyOnly) && preRefusals.length) { console.error("⛔ 前置檢查未通過，未讀取也未寫入任何資料：\n" + preRefusals.map((e) => "  - " + e).join("\n")); process.exit(2); }

  // 複本；原檔前後比對
  const before = { hash: sha256File(sqlitePath), size: fs.statSync(sqlitePath).size, mtime: fs.statSync(sqlitePath).mtimeMs };
  let tmpBase: string; try { tmpBase = resolveTempBase(arg("--tmp-dir")); } catch (e) { console.error("❌ " + (e as Error).message); process.exit(1); }
  const swept = sweepStaleWorkspaces(tmpBase);
  if (swept.removed) console.log(`（已清掉 ${swept.removed} 個本工具先前遺留的暫存資料夾）`);
  fs.mkdirSync(tmpBase, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(tmpBase, "nande-migrate-"));
  const copy = path.join(tmpDir, "copy.db");
  fs.copyFileSync(sqlitePath, copy);
  if (sha256File(copy) !== before.hash) throw new Error("複本與原檔不一致，已停止。");
  let client: any = null; const cleanupNotes: string[] = [];
  try {
    console.log("1/4 以 Prisma 讀取 SQLite 複本…（首次會臨時產生讀取用 client，約數十秒）");
    const read = readSqliteWithPrisma({ schemaText, models: schema.map((m) => m.name), copyPath: copy, projectDir: process.cwd(), tmpBase });
    const source = read.data; cleanupNotes.push(read.cleanup.ok ? "Prisma 讀取用的暫存工作區（系統 TEMP）已清除。" : `【提醒】Prisma 讀取用的暫存資料夾未能清除：${read.cleanup.dir}（${read.cleanup.error}）。可安全手動刪除；不影響搬移結果與任何來源資料。`);
    if (!read.cleanup.ok) console.warn("⚠ " + cleanupNotes[cleanupNotes.length - 1]);
    console.log("2/4 以獨立方式（sql.js）再讀一次，逐表比對雜湊…");
    const crossCheck = await readSqlJs(schema, new Uint8Array(fs.readFileSync(copy)));

    let pgLike: { query: (s: string, p?: unknown[]) => Promise<{ rows: any[] }> } | null = null;
    if (!args.noNeon && !urlProblem && url) {
      console.log("3/4 連線 Neon（DIRECT_URL，內容不顯示）…");
      const pg = require("pg");
      client = new pg.Client({ connectionString: url, types: utcTypes(pg.types), connectionTimeoutMillis: 20000, application_name: "nande-migrate" });
      try { await client.connect(); } catch (e) { console.error("❌ 連線 Neon 失敗（沒有寫入任何資料）：" + redact(String((e as Error).message))); process.exit(1); }
      pgLike = client;
    } else console.log("3/4 未連線 Neon" + (args.noNeon ? "（--no-neon）" : "（沒有可用的 DIRECT_URL）"));

    console.log("4/4 " + (args.apply ? "執行正式搬移…" : "分析…"));
    const rep = await runMigration({ schema, source, crossCheck, pg: pgLike, args, redact, preRefusals });

    const after = { hash: sha256File(sqlitePath), size: fs.statSync(sqlitePath).size, mtime: fs.statSync(sqlitePath).mtimeMs };
    const unchanged = before.hash === after.hash && before.size === after.size && before.mtime === after.mtime;
    rep.steps.push(...cleanupNotes);
    rep.steps.push(`SQLite 原始檔 SHA-256／大小／修改時間搬移前後${unchanged ? "完全相同" : "【不同！】"}；讀取的是暫存複本，結束後已刪除。`);

    const outBase = path.resolve(arg("--out") ?? path.join(path.dirname(sqlitePath), "reports"));
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
    const outDir = makeFreshDir(outBase, `pg-migrate-${rep.mode}-${stamp}`);
    fs.writeFileSync(path.join(outDir, "report.md"), reportMarkdown(rep), { flag: "wx" });
    fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(rep, null, 2), { flag: "wx" });
    fs.writeFileSync(path.join(outDir, "plan.csv"), planCsv(rep), { flag: "wx" });

    console.log(`\n【各表${args.apply ? "" : "計畫"}筆數】`);
    for (const p of rep.plan) console.log(`  ${p.table.padEnd(26)} ${String(p.rows).padStart(5)}${p.targetRows !== null ? `   （Neon 目前 ${p.targetRows}）` : ""}`);
    console.log(`  ${"合計".padEnd(24)} ${String(rep.sourceTotal).padStart(5)}`);
    for (const i of rep.issues.filter((x) => x.severity === "warning")) console.log("  ⚠ " + i.message);
    console.log(`\n結果：${rep.outcome}${rep.error ? "｜" + rep.error : ""}`);
    for (const r of rep.refusals) console.log("  ⛔ " + r);
    if (rep.postCommitVerification) console.log("COMMIT 後獨立驗證：" + (rep.postCommitVerification.ok ? "✅ 通過" : "❌ 不符"));
    console.log(`SQLite 原始檔${unchanged ? "未被改動 ✅" : "【被改動了！】"}\n報告：${outDir}`);
    if (rep.outcome === "dry-run" && !rep.refusals.length) console.log(`\n乾跑完成，沒有寫入任何資料。正式搬移指令：\n  npm run db:migrate-to-pg -- --sqlite "${sqlitePath}" --apply --confirm --expect-total ${rep.sourceTotal}`);
    const ok = (rep.outcome === "dry-run" && !rep.refusals.length) || (rep.outcome === "committed" && !rep.error && rep.postCommitVerification?.ok) || (rep.outcome === "verify-only" && rep.verification?.ok);
    process.exitCode = ok ? 0 : rep.outcome === "rolled-back" || rep.error ? 1 : 2;
  } finally {
    if (client) await client.end().catch(() => {});
    try { fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { console.warn(`⚠ 暫存複本資料夾未能清除：${tmpDir}（${(e as Error).message}）。可安全手動刪除。`); }
  }
}
main().catch((e) => { console.error("❌ 失敗：", String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s'"]+/gi, "[已隱藏的連線字串]")); process.exit(1); });
