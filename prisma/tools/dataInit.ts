/**
 * 一次性設定：npm run data:init -- --dir "<固定資料資料夾>" --from-db "<現有 dev.db>" --from-uploads "<現有 public\uploads>"
 * - 建立固定資料資料夾（uploads、backups），把正式資料庫與既有上傳圖片「複製」進去（來源不動、不覆蓋）。
 * - 把資料夾位置記在使用者家目錄的 .nande-platform.json（不在專案裡，換新版 ZIP 不受影響，也不會被上傳到 GitHub）。
 * - 之後每個新版本資料夾都會自動讀到同一個位置；若想改用環境變數 NANDE_DATA_DIR，也可以（優先於設定檔）。
 */
import fs from "fs";
import path from "path";
import { configFilePath, readConfigFile, resolveDataConfig } from "../../lib/config/dataConfig";
import { initDataDir } from "./dataInitCore";

function arg(name: string): string[] {
  const out: string[] = [];
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) if (a[i] === name && a[i + 1]) out.push(a[++i]!);
  return out;
}

function main() {
  const dir = arg("--dir")[0];
  if (!dir) {
    console.log('用法：npm run data:init -- --dir "C:\\Users\\你\\Desktop\\南得遇見你資料" --from-db "舊的 dev.db 路徑" --from-uploads "舊的 public\\uploads 路徑"');
    process.exit(1);
  }
  const absDir = path.resolve(dir);
  if (path.relative(process.cwd(), absDir) === "" || !path.relative(process.cwd(), absDir).startsWith("..")) {
    console.log("❌ 固定資料資料夾不可放在程式資料夾裡面（換版會遺失）。請選程式資料夾以外的位置。");
    process.exit(1);
  }
  const existing = readConfigFile();
  if (existing?.dataDir && path.resolve(existing.dataDir) !== absDir && !process.argv.includes("--force-config")) {
    console.log(`❌ 家目錄設定檔已指向另一個資料夾：${existing.dataDir}\n如果確定要改指向 ${absDir}，請加上 --force-config。`);
    process.exit(1);
  }

  const res = initDataDir({
    dataDir: absDir,
    fromDb: arg("--from-db")[0],
    fromUploads: arg("--from-uploads"),
    bundledUploads: path.join(process.cwd(), "prisma", "assets", "uploads"),
  });
  console.log(res.lines.join("\n"));
  if (!res.ok) process.exit(1);

  fs.writeFileSync(configFilePath(), JSON.stringify({ dataDir: absDir }, null, 2) + "\n", "utf-8");
  console.log(`\n✅ 已記錄固定資料位置：${configFilePath()}`);
  try {
    resolveDataConfig();
    console.log("✅ 設定檢查通過。下一步：npm run db:doctor（確認資料筆數），再 npm run dev。");
  } catch (e) {
    console.log("⚠ 設定檢查失敗：" + (e as Error).message);
    process.exit(1);
  }
  const envHint = process.env.NANDE_DATA_DIR && path.resolve(process.env.NANDE_DATA_DIR) !== absDir;
  if (envHint) console.log("⚠ 注意：環境變數 NANDE_DATA_DIR 指向別處，它的優先權比設定檔高，請確認。");
  console.log("提示：.env 裡的 DATABASE_URL 這一行已不再使用，可以刪除。");
}
main();
