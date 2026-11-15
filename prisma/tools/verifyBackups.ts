/**
 * npm run db:verify-backup — 唯讀：列出固定資料夾 backups/ 裡的備份，檢查大小是否合理、能否開啟、完整性與主要資料筆數，
 * 並和目前使用中的資料庫比較。不修改、不刪除任何檔案。
 */
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";
import { sqliteUrlFromFile } from "../../lib/config/dataConfig";
import { verifyDatabase } from "./verifyCore";

async function main() {
  const cfg = loadConfigOrExit();
  if (cfg.mode !== "local") {
    console.log("遠端模式請使用資料庫服務的備份檢查。");
    process.exit(1);
  }
  console.log(describeConfig(cfg).join("\n") + "\n");
  const liveSize = statSync(cfg.dbFile).size;
  const { prisma: live } = openPrisma(cfg);
  let liveCounts: Record<string, number | null> = {};
  try {
    const r = await verifyDatabase((sql) => live.$queryRawUnsafe(sql) as Promise<Record<string, unknown>[]>);
    liveCounts = r.counts;
    console.log("【使用中的資料庫】\n  " + r.lines.join("\n  ") + "\n");
  } finally {
    await live.$disconnect();
  }
  const files = existsSync(cfg.backupsDir) ? readdirSync(cfg.backupsDir).filter((f) => /\.db$/i.test(f)).sort() : [];
  if (!files.length) {
    console.log("⚠ 備份資料夾裡沒有備份檔。請先執行 npm run db:backup。");
    process.exit(1);
  }
  let bad = 0;
  for (const f of files) {
    const file = path.join(cfg.backupsDir, f);
    const size = statSync(file).size;
    console.log(`【${f}】${(size / 1024).toFixed(1)} KB（使用中 ${(liveSize / 1024).toFixed(1)} KB）`);
    if (size < liveSize * 0.3) console.log("  ⚠ 檔案明顯比使用中的資料庫小，請確認是否完整。");
    const p = new PrismaClient({ datasourceUrl: sqliteUrlFromFile(file) });
    try {
      const r = await verifyDatabase((sql) => p.$queryRawUnsafe(sql) as Promise<Record<string, unknown>[]>);
      console.log("  " + r.lines.join("\n  "));
      const fewer = Object.keys(liveCounts).filter((k) => (r.counts[k] ?? 0) > (liveCounts[k] ?? 0));
      if (fewer.length) console.log(`  ℹ 這份備份的 ${fewer.join("、")} 筆數比使用中的多（備份之後可能有刪除資料）。`);
      if (!r.ok) bad++;
    } finally {
      await p.$disconnect();
    }
  }
  console.log(bad ? `\n❌ 有 ${bad} 份備份無法通過檢查。` : `\n✅ ${files.length} 份備份都能開啟且完整。`);
  console.log("提醒：上傳圖片的備份要另外做（複製 " + cfg.uploadsDir + "）。");
  process.exit(bad ? 1 : 0);
}
main().catch((e) => {
  console.error("檢查失敗：", e);
  process.exit(1);
});
