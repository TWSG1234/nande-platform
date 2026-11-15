/** 專案資料夾「衛生檢查」核心（唯讀）：找出不該出現在程式資料夾／ZIP 裡的資料檔與設定。 */
import fs from "fs";
import path from "path";
import { compareSchemaFiles } from "./schemaSync";

export interface GuardFinding {
  level: "error" | "warn";
  message: string;
}

export function guardProject(projectDir: string): GuardFinding[] {
  const out: GuardFinding[] = [];
  const has = (rel: string) => fs.existsSync(path.join(projectDir, rel));
  for (const rel of ["prisma/dev.db", "dev.db", "prisma/dev.db-journal", "prisma/dev.db-wal"]) {
    if (has(rel)) out.push({ level: "warn", message: `程式資料夾內有資料庫檔案 ${rel}：網站不會使用它。請勿把固定資料庫複製回來，也不要把它放進 ZIP。` });
  }
  if (has(".nande-platform.json")) out.push({ level: "error", message: "程式資料夾內有 .nande-platform.json：這是使用者本機設定，不可放進專案或 ZIP。" });
  if (has("public/uploads")) out.push({ level: "warn", message: "程式資料夾內有 public/uploads：上傳圖片應在固定資料夾；這裡的檔案不會被網站提供。請確認已複製到固定資料夾後再處理。" });
  if (has("prisma/migrations")) out.push({ level: "warn", message: "有 prisma/migrations：請確認它與實際資料庫一致後才使用（本專案目前沒有 migration 歷史）。" });
  if (has(".env")) {
    const env = fs.readFileSync(path.join(projectDir, ".env"), "utf-8");
    if (/^\s*DATABASE_URL\s*=\s*["']?file:/m.test(env)) out.push({ level: "warn", message: ".env 內仍有 DATABASE_URL=file:…：本機模式會忽略，建議整行刪除，避免誤會。" });
  }
  // 兩份 schema（SQLite／PostgreSQL）必須一致；build／postinstall 必須走選擇腳本
  const pair = compareSchemaFiles(projectDir);
  if (pair) for (const p of pair.problems) out.push({ level: "error", message: `schema 不一致：${p}（修改 model 時 schema.prisma 與 schema.postgres.prisma 要一起改）。` });
  if (has("package.json")) {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
    for (const k of ["build", "postinstall"]) {
      const v = String(pkg.scripts?.[k] ?? "");
      if (has("prisma/schema.postgres.prisma") && /prisma generate/.test(v) && !/prisma-generate\.js/.test(v)) out.push({ level: "error", message: `package.json 的 ${k} 直接執行 prisma generate：Vercel 會用到 SQLite schema。請改用 node scripts/prisma-generate.js。` });
    }
  }
  // 程式碼不得直接寫入 public/uploads 或自己組 file: 連線字串
  const scan = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git", "backups", "assets"].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) scan(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/guardCore\.ts$/.test(e.name) && !/\/dataConfig\.ts$/.test(p.replace(/\\/g, "/"))) {
        const src = fs.readFileSync(p, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
        const rel = path.relative(projectDir, p);
        if (/["'`]public["'`]\s*,\s*["'`]uploads["'`]/.test(src) && !/dataInit|restoreLife/.test(rel)) out.push({ level: "error", message: `${rel} 直接使用 public/uploads 路徑，應改走 lib/storage。` });
        if (/new PrismaClient\(\s*\)/.test(src)) out.push({ level: "error", message: `${rel} 以預設方式建立 PrismaClient（會讀 .env 的 DATABASE_URL），應改用 lib/prisma.ts 或 prisma/tools/dbClient.ts。` });
      }
    }
  };
  scan(projectDir);
  return out;
}
