/**
 * npm run audit:uploads — 遷移到 Cloudinary 前的【唯讀】掃描。
 *  - 只讀 uploads 檔案、只對資料庫執行 SELECT；不上傳、不連網路、不寫資料庫、不刪除／移動／改名任何檔案。
 *  - 報告寫到「固定資料資料夾\reports\uploads-audit-<時間>\」（新資料夾，不覆蓋既有檔案）。
 * 參數：--out <資料夾>  --folder <CLOUDINARY_FOLDER，預設讀環境變數或 nande-platform>
 *       --max-image-mb <數字，預設 10>  --max-video-mb <數字，預設 100>  --no-hash（不計算 SHA-256，較快）
 */
import fs from "fs";
import path from "path";
import { loadConfigOrExit, describeConfig, openPrisma } from "./dbClient";
import { buildAudit, collectDbRefs, filesCsv, formatMB, missingCsv, summaryMarkdown, walkUploads, type Query } from "./uploadsAuditCore";
import { normalizeFolder } from "../../lib/storage/cloudinary";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  console.log("=== uploads 遷移前掃描（唯讀）===\n");
  const cfg = loadConfigOrExit();
  console.log(describeConfig(cfg).join("\n") + "\n");
  if (cfg.mode !== "local" || !cfg.uploadsDir) { console.error("❌ 目前只支援本機模式（需要固定資料夾的 uploads 與 dev.db）。"); process.exit(1); }
  if (!fs.existsSync(cfg.uploadsDir)) { console.error("❌ 找不到上傳資料夾：" + cfg.uploadsDir); process.exit(1); }

  let folder: string;
  try { folder = normalizeFolder(arg("--folder") ?? process.env.CLOUDINARY_FOLDER); } catch (e) { console.error("❌ " + (e as Error).message); process.exit(1); }
  const limits = { maxImageBytes: Number(arg("--max-image-mb") ?? 10) * 1024 * 1024, maxVideoBytes: Number(arg("--max-video-mb") ?? 100) * 1024 * 1024 };

  console.log("1/3 掃描 uploads 檔案…");
  const { files, internal } = walkUploads(cfg.uploadsDir, { hash: !process.argv.includes("--no-hash") });
  console.log(`    ${files.length} 個檔案`);

  console.log("2/3 讀取資料庫中的圖片引用（只執行 SELECT）…");
  const { prisma } = openPrisma(cfg);
  const query: Query = async (sql) => (await prisma.$queryRawUnsafe(sql)) as Record<string, unknown>[];
  const db = await collectDbRefs(query).finally(() => prisma.$disconnect());
  console.log(`    ${db.tablesScanned.length} 張資料表、${db.refs.length} 筆 /uploads/ 引用`);

  const seedDir = path.join(process.cwd(), "prisma", "assets", "uploads");
  const seedRels = new Set<string>();
  if (fs.existsSync(seedDir)) for (const f of walkUploads(seedDir, { hash: false }).files) seedRels.add(f.rel);

  console.log("3/3 分析並輸出報告…");
  const rep = buildAudit({ files, internal, refs: db.refs, folder, limits, seedRels, driveRows: db.driveRows, tablesScanned: db.tablesScanned, tablesSkipped: db.tablesSkipped });

  const baseOut = arg("--out") ? path.resolve(arg("--out")!) : path.join(cfg.dataDir, "reports");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const outDir = path.join(baseOut, `uploads-audit-${stamp}`);
  fs.mkdirSync(baseOut, { recursive: true });
  fs.mkdirSync(outDir); // 不加 recursive：資料夾已存在就失敗，絕不覆蓋
  fs.writeFileSync(path.join(outDir, "summary.md"), summaryMarkdown(rep), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "files.csv"), filesCsv(rep), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "missing-refs.csv"), missingCsv(rep), { flag: "wx" });
  fs.writeFileSync(path.join(outDir, "files.json"), JSON.stringify(rep, null, 2), { flag: "wx" });

  console.log(`\n【結果】`);
  console.log(`  uploads 檔案：${rep.totals.files} 個，${formatMB(rep.totals.bytes)}`);
  console.log(`  使用中：${rep.used.files} 個（${formatMB(rep.used.bytes)}）／ 歷史未引用：${rep.unreferenced.files} 個（${formatMB(rep.unreferenced.bytes)}）`);
  console.log(`  第一批預計遷移：${rep.batch1.files} 個（${formatMB(rep.batch1.bytes)}）`);
  console.log(`  不可直接遷移：${rep.notMigratable.files} 個；資料庫有引用但找不到檔案：${rep.missing.length} 個；public_id 衝突：${rep.conflicts.length} 組`);
  console.log(`\n報告已寫入（沒有修改任何既有檔案或資料庫）：\n  ${outDir}`);
  console.log("請把 summary.md 的內容貼給我（files.csv 內有每個檔案的路徑與預計 public_id，可視需要提供）。");
}
main().catch((e) => { console.error("❌ 掃描失敗（沒有修改任何資料）：", e?.message ?? e); process.exit(1); });
