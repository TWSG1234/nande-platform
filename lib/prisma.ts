import { PrismaClient } from "@prisma/client";
import { getDataConfig } from "@/lib/config/dataConfig";

// Next.js dev 模式會 hot-reload 模組，若每次都 new PrismaClient() 會很快用光
// 連線數。這裡用全域變數快取單一 instance，是 Prisma 官方建議的標準寫法。
//
// 連線位置完全由 lib/config/dataConfig.ts 決定（固定資料資料夾裡的 dev.db，或未來的遠端 DATABASE_URL），
// 不讀 .env 的 DATABASE_URL、不讀程式資料夾裡的 dev.db。設定錯誤會在這裡直接丟出明確的錯誤訊息
// （不會被各頁面的「讀不到就顯示範例資料」吞掉，也不會自動建立新的空白資料庫）。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const cfg = getDataConfig();
  if (process.env.NODE_ENV === "development" && cfg.warnings.length) {
    for (const w of cfg.warnings) console.warn("[資料設定]", w);
  }
  return new PrismaClient({
    datasourceUrl: cfg.dbUrl,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
