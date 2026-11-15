/**
 * npm run db:backup — 備份「網站實際使用的」固定資料庫到 <固定資料資料夾>/backups/。
 * 使用 SQLite 的 VACUUM INTO：產生一致、完整的副本，網站執行中也可以做。不修改、不刪除原資料庫。
 */
import { statSync } from "fs";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";
import { runBackup } from "./backupCore";

async function main() {
  const cfg = loadConfigOrExit();
  if (cfg.mode !== "local") {
    console.log("遠端（PostgreSQL）模式請使用資料庫服務的備份功能（pg_dump／供應商快照）。");
    process.exit(1);
  }
  console.log(describeConfig(cfg).join("\n") + "\n");
  const { prisma } = openPrisma(cfg);
  try {
    const target = await runBackup(prisma, cfg);
    console.log(`✅ 已備份：${target}（${(statSync(target).size / 1024).toFixed(1)} KB，原檔 ${(statSync(cfg.dbFile).size / 1024).toFixed(1)} KB）`);
    console.log("提醒：上傳的圖片在 " + cfg.uploadsDir + "，不在資料庫裡，請一起複製備份。");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error("備份失敗：", e);
  process.exit(1);
});
