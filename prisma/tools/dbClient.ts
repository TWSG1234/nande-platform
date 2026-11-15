/**
 * 所有 tsx 工具腳本（備份、診斷、匯入、seed…）取得資料庫連線的唯一入口。
 * 與網站（lib/prisma.ts）使用同一個設定核心 lib/config/dataConfig.ts，
 * 所以工具與網站一定連到同一份資料庫，且設定錯誤時明確報錯、不會自動建立新資料庫。
 */
import { PrismaClient } from "@prisma/client";
import { DataConfigError, resolveDataConfig, type DataConfig } from "../../lib/config/dataConfig";

/** 遠端（Neon／PostgreSQL）模式下，所有 SQLite 維運與資料變更工具一律拒絕。 */
export const REMOTE_REFUSAL =
  "目前設定為遠端資料庫模式（NANDE_DB_MODE=remote）。備份、診斷、匯入、seed、restore、db push／migrate 等維運工具只能用在本機 SQLite，" +
  "已拒絕執行，沒有連線也沒有改動任何資料。若要使用請取消 NANDE_DB_MODE=remote（本機開發不需要它）。";

export function loadConfigOrExit(opt: Parameters<typeof resolveDataConfig>[0] = {}, flags: { allowRemote?: boolean } = {}): DataConfig {
  try {
    const cfg = resolveDataConfig(opt);
    if (cfg.mode === "remote" && !flags.allowRemote) {
      console.error("⛔ " + REMOTE_REFUSAL);
      process.exit(1);
    }
    return cfg;
  } catch (e) {
    if (e instanceof DataConfigError) {
      console.error("❌ " + e.message);
      process.exit(1);
    }
    throw e;
  }
}

export function describeConfig(cfg: DataConfig): string[] {
  if (cfg.mode === "remote") return ["資料庫：遠端（DATABASE_URL，未顯示）"];
  return [
    `固定資料資料夾：${cfg.dataDir}（來源：${cfg.dataDirSource === "env" ? "環境變數 NANDE_DATA_DIR" : "家目錄設定檔"}）`,
    `資料庫：${cfg.dbFile}`,
    `上傳資料夾：${cfg.uploadsDir}`,
    `備份資料夾：${cfg.backupsDir}`,
  ];
}

export function openPrisma(cfg: DataConfig = loadConfigOrExit()): { prisma: PrismaClient; cfg: DataConfig } {
  if (cfg.mode !== "local" || !cfg.dbUrl.startsWith("file:")) {
    console.error("⛔ " + REMOTE_REFUSAL);
    process.exit(1);
  }
  for (const w of cfg.warnings) console.warn("⚠ " + w);
  return { prisma: new PrismaClient({ datasourceUrl: cfg.dbUrl }), cfg };
}

/** 會改寫／重設資料的工具：必須明確加上 --confirm 才會執行。 */
export function requireConfirm(toolName: string, whatItDoes: string, alsoAllowed: string[] = []) {
  const args = process.argv.slice(2);
  if (args.includes("--confirm") || alsoAllowed.some((a) => args.includes(a))) return;
  console.log(`⛔ ${toolName}：${whatItDoes}`);
  console.log("這是特殊操作，不屬於一般更新流程。請先 npm run db:backup，並確認要執行，再加上 --confirm：");
  console.log(`   npm run <指令> -- --confirm`);
  process.exit(1);
}
