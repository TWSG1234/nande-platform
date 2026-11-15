/**
 * npm run db:update — 「一般更新」的安全檢查流程（每次換新版程式資料夾後執行）。
 * 1) 確認連到固定資料庫  2) 備份  3) 產生 Prisma Client  4) 比對 schema 與資料庫
 * 5) 有差異時只「列出並說明」，不自動修改  6) 健康檢查
 * 另含「內容小修補」（contentPatch：只更新還是內建舊圖的項目，不覆蓋後台改過的）。
 * 不會執行 seed、匯入、重設、db push。
 */
import { spawnSync } from "child_process";
import path from "path";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";
import { runBackup } from "./backupCore";
import { applyContentPatches } from "./contentPatch";
import { parseSchemaFile, runDoctor } from "./doctorCore";

async function main() {
  const cfg = loadConfigOrExit();
  if (cfg.mode !== "local") {
    console.log("遠端模式請使用 prisma migrate deploy 與供應商備份。");
    process.exit(1);
  }
  console.log("【1】固定資料庫\n" + describeConfig(cfg).join("\n"));
  const { prisma } = openPrisma(cfg);
  try {
    console.log("\n【2】備份\n✅ " + (await runBackup(prisma, cfg, "before-update")));

    console.log("\n【3】產生 Prisma Client");
    const cli = require.resolve("prisma/build/index.js", { paths: [process.cwd()] });
    const gen = spawnSync(process.execPath, [cli, "generate"], { stdio: "inherit", cwd: process.cwd() });
    if (gen.status !== 0) throw new Error("prisma generate 失敗");

    console.log("\n【4】schema 與資料庫比對（唯讀）");
    const expected = parseSchemaFile(path.join(process.cwd(), "prisma", "schema.prisma"));
    const report = await runDoctor((sql) => prisma.$queryRawUnsafe(sql) as Promise<Record<string, unknown>[]>, expected);
    if (report.missingTables.length === 0 && report.missingColumns.length === 0) {
      console.log("  ✅ 沒有 schema 變更需要套用。只需要重啟網站。");
    } else {
      console.log(report.lines.slice(0, 8).join("\n"));
      console.log("\n  ➜ 這次更新有資料庫結構變更。我沒有自動套用。請看更新說明確認風險後，手動執行：\n     npm run db:push   （會先自動備份；只新增資料表／欄位，不刪除資料）");
    }

    console.log("\n【4b】內容小修補（已先備份；只改「還是內建舊圖」的項目，不覆蓋你在後台改過的）");
    console.log((await applyContentPatches(prisma, cfg)).join("\n"));

    console.log("\n【5】健康檢查\n" + report.lines.join("\n"));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error("更新檢查失敗：", e);
  process.exit(1);
});
