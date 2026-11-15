/**
 * npm run migrate:uploads — 第一批圖片遷移（本機 uploads → Cloudinary），只處理掃描報告中 batch=1（使用中）的檔案。
 *
 * 預設是【預演 dry-run】：只列出「將會上傳哪些」，不連線上傳、不寫帳本。
 *   npm run migrate:uploads                          預演（不連網路）
 *   npm run migrate:uploads -- --check-remote        預演＋唯讀檢查 Cloudinary 上是否已存在
 *   npm run migrate:uploads -- --apply --confirm --expect-count 64     正式上傳（需要全部三個參數）
 * 其他參數：--report <files.json 路徑>（預設用最新一份掃描報告）  --limit <N>（只處理清單前 N 筆，做小量試跑）
 *
 * 絕不：修改資料庫、修改圖片網址、刪除／移動／改名本機檔案、覆蓋或刪除 Cloudinary 上的任何檔案。
 * 金鑰只從環境變數／.env.local 讀取，不會顯示或寫進任何報告。
 */
import fs from "fs";
import path from "path";
import { DataConfigError, resolveDataConfig } from "../../lib/config/dataConfig";
import {
  appendLedger, dryRunCsv, loadPlan, planSummaryMd, readLedger, resultCsv, resultSummaryMd, runApply, runDryRun, summarize, type MigrateStorage,
} from "./uploadsMigrateCore";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = (name: string) => process.argv.includes(name);

// 這個工具不需要資料庫（完全不開啟 Prisma），只用固定資料夾的設定找 uploads 與報告位置。
function loadConfigOrExit() {
  try { return resolveDataConfig(); } catch (e) { if (e instanceof DataConfigError) { console.error("❌ " + e.message); process.exit(1); } throw e; }
}

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

/** 建立一個「全新」的資料夾（絕不重用或覆蓋既有的）；同一秒內重複執行時自動加上 -2、-3…。 */
function makeFreshDir(parent: string, name: string): string {
  for (let i = 1; i < 1000; i++) {
    const dir = path.join(parent, i === 1 ? name : `${name}-${i}`);
    try { fs.mkdirSync(dir); return dir; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  }
  throw new Error("無法建立新的報告資料夾。");
}

function findReport(reportsDir: string): string {
  const explicit = arg("--report");
  if (explicit) return path.resolve(explicit);
  const dirs = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).filter((d) => /^uploads-audit-/.test(d)).sort() : [];
  const latest = dirs[dirs.length - 1];
  if (!latest) { console.error(`❌ 找不到掃描報告（${reportsDir}\\uploads-audit-*）。請先執行 npm run audit:uploads，或用 --report 指定 files.json。`); process.exit(1); }
  return path.join(reportsDir, latest, "files.json");
}

async function main() {
  loadEnvLocal();
  const apply = flag("--apply");
  console.log(`=== 第一批圖片遷移（${apply ? "正式上傳" : "預演 dry-run，不會上傳"}）===\n`);
  const cfg = loadConfigOrExit();
  if (cfg.mode === "local") console.log(`固定資料資料夾：${cfg.dataDir}\n上傳資料夾：${cfg.uploadsDir}\n`);
  if (cfg.mode !== "local" || !cfg.uploadsDir) { console.error("❌ 目前只支援本機模式。"); process.exit(1); }

  const { normalizeFolder } = await import("../../lib/storage/cloudinary");
  const folder = normalizeFolder(process.env.CLOUDINARY_FOLDER);
  const reportsDir = path.join(cfg.dataDir, "reports");
  const reportPath = findReport(reportsDir);
  console.log("使用的掃描報告：" + reportPath);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

  const limitArg = arg("--limit"), expectArg = arg("--expect-count");
  const plan = loadPlan(report, { folder, uploadsDir: cfg.uploadsDir, expectCount: expectArg ? Number(expectArg) : undefined, limit: limitArg ? Number(limitArg) : undefined });
  console.log(`清單：${plan.items.length} 個（報告 batch=1 共 ${plan.batch1Total} 個；不處理 batch=2 ${plan.excluded.batch2} 個、batch=0 ${plan.excluded.batch0} 個）`);
  if (plan.errors.length) { console.log(`\n❌ 清單與本機檔案不一致（${plan.errors.length} 筆）：`); for (const e of plan.errors) console.log(`  - ${e.url}：${e.problem}`); }

  const migrateDir = path.join(reportsDir, "uploads-migrate");
  const ledgerFile = path.join(migrateDir, "ledger.jsonl");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");

  // ── 正式上傳（只有 --apply 才檢查）：必須同時有 --confirm 與 --expect-count。預演與 --check-remote 不受影響 ──
  if (apply && (!flag("--confirm") || !expectArg)) {
    console.error(`\n⛔ 正式上傳需要同時加上 --confirm 與 --expect-count <數量>（目前報告 batch=1 為 ${plan.batch1Total} 個），例如：\n   npm run migrate:uploads -- --apply --confirm --expect-count ${plan.batch1Total}\n請先看過預演報告再執行。`);
    process.exit(1);
  }
  if (apply && plan.errors.length) { console.error("\n⛔ 清單有問題，拒絕上傳。請先處理上面的項目（必要時重新掃描）。"); process.exit(1); }


  // Cloudinary 儲存端（預演時只有加 --check-remote 才建立；只會呼叫唯讀的 inspect）
  let storage: MigrateStorage | undefined;
  if (apply || flag("--check-remote")) {
    const { createCloudinaryStorageFromEnv } = await import("../../lib/storage/cloudinary");
    const st = await createCloudinaryStorageFromEnv();
    storage = st;
    console.log(`Cloudinary 資料夾：${folder}（金鑰來自環境變數，不顯示）`);
  }

  if (!apply) {
    const dry = await runDryRun(plan, { ledger: readLedger(ledgerFile), storage });
    fs.mkdirSync(migrateDir, { recursive: true });
    const outDir = makeFreshDir(migrateDir, `dry-run-${stamp}`);
    fs.writeFileSync(path.join(outDir, "dry-run.csv"), dryRunCsv(dry.rows), { flag: "wx" });
    fs.writeFileSync(path.join(outDir, "dry-run.json"), JSON.stringify({ plan, dry }, null, 2), { flag: "wx" });
    fs.writeFileSync(path.join(outDir, "summary.md"), planSummaryMd(plan, dry, { reportPath, checkedRemote: !!storage }), { flag: "wx" });
    console.log(`\n【預演結果】預計上傳 ${dry.toUpload} 個（${(dry.toUploadBytes / 1024 / 1024).toFixed(2)} MB）；已存在略過 ${dry.skipExisting}；帳本已完成 ${dry.skipLedger}${dry.unchecked ? `；尚未檢查雲端 ${dry.unchecked}` : ""}`);
    console.log(`報告：${outDir}\n沒有上傳任何檔案、沒有修改任何資料。`);
    process.exit(plan.errors.length ? 1 : 0);
  }

  fs.mkdirSync(migrateDir, { recursive: true });
  const outDir = makeFreshDir(migrateDir, `run-${stamp}`);
  const runId = path.basename(outDir);
  const results = await runApply(plan, {
    storage: storage!, runId, ledger: readLedger(ledgerFile), appendLedger: (e) => appendLedger(ledgerFile, e), log: (s) => console.log(s),
    readLocal: (rel) => fs.readFileSync(path.join(cfg.uploadsDir!, ...rel.split("/"))),
  });
  fs.writeFileSync(path.join(outDir, "result.csv"), resultCsv(results), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(results, null, 2), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "summary.md"), resultSummaryMd(plan, results, { reportPath, runId }), { flag: "wx" });
  const s = summarize(results);
  console.log(`\n【結果】清單 ${s.total}｜新上傳 ${s.uploaded}｜已存在略過 ${s.skippedExists}｜先前已完成 ${s.skippedLedger}｜失敗 ${s.failed}｜未執行 ${s.notAttempted}`);
  console.log(`驗證：通過 ${s.verified}｜內容不一致 ${s.mismatch}｜驗證失敗 ${s.verifyFailed}`);
  console.log(`報告：${outDir}\n帳本：${ledgerFile}`);
  process.exit(s.failed || s.notAttempted || s.mismatch || s.verifyFailed ? 1 : 0);
}
main().catch((e) => { console.error("❌ 失敗（沒有修改資料庫與本機檔案）：", e?.message ?? e); process.exit(1); });
