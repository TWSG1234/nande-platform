import { existsSync, mkdirSync, statSync } from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import type { LocalDataConfig } from "../../lib/config/dataConfig";

/** 用 SQLite 的 VACUUM INTO 備份「正在使用的」資料庫到固定資料夾的 backups/；不覆蓋、不修改原檔。 */
export async function runBackup(prisma: PrismaClient, cfg: LocalDataConfig, label = "dev"): Promise<string> {
  mkdirSync(cfg.backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const target = path.join(cfg.backupsDir, `${label}-${stamp}.db`);
  if (existsSync(target)) throw new Error(`備份檔已存在：${target}（不覆蓋）`);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  if (!existsSync(target) || statSync(target).size === 0) throw new Error("備份檔沒有成功建立。");
  return target;
}
