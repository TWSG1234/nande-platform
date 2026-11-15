/**
 * npm run db:doctor — 唯讀診斷：連到哪份資料庫／上傳資料夾、資料庫結構是否跟得上目前程式、各區塊實際有多少資料。
 * 不寫入、不刪除、不建立資料庫。
 */
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { parseSchemaFile, runDoctor } from "./doctorCore";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";

async function main() {
  console.log("=== 南得遇見你 資料庫診斷（唯讀）===\n");
  console.log("程式資料夾：", process.cwd());
  const cfg = loadConfigOrExit();
  console.log(describeConfig(cfg).join("\n"));
  if (cfg.mode !== "local") {
    console.log("遠端模式：診斷目前只支援本機 SQLite。");
    process.exit(1);
  }
  const st = statSync(cfg.dbFile);
  console.log(`大小 ${(st.size / 1024).toFixed(1)} KB，最後修改 ${st.mtime.toLocaleString("zh-TW", { hour12: false })}\n`);

  // 程式資料夾裡若有另一份 dev.db：明確告知「不會被使用」，避免誤會。
  const stray = [path.join(process.cwd(), "prisma", "dev.db"), path.join(process.cwd(), "dev.db")].filter((f) => existsSync(f));
  if (stray.length) console.log("ℹ 程式資料夾內另有資料庫檔案（網站不會使用它們）：\n" + stray.map((f) => "  - " + f).join("\n") + "\n");

  const countFiles = (dir: string): number =>
    existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? countFiles(path.join(dir, e.name)) : e.name.startsWith(".") ? 0 : 1), 0) : 0;
  console.log(`上傳檔案（${cfg.uploadsDir}）：${countFiles(cfg.uploadsDir!)} 個`);
  const backups = existsSync(cfg.backupsDir) ? readdirSync(cfg.backupsDir).filter((f) => /\.db$/i.test(f)) : [];
  console.log(`備份檔（${cfg.backupsDir}）：${backups.length} 個\n`);

  const { prisma } = openPrisma(cfg);
  try {
    const expected = parseSchemaFile(path.join(process.cwd(), "prisma", "schema.prisma"));
    const report = await runDoctor((sql) => prisma.$queryRawUnsafe(sql) as Promise<Record<string, unknown>[]>, expected);
    console.log(report.lines.join("\n"));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("診斷失敗：", e);
  process.exit(1);
});
