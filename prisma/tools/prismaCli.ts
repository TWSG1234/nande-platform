/**
 * Prisma CLI 包裝：npm run db:push / db:studio / db:migrate 都走這裡。
 * 先解析固定資料庫，再把 DATABASE_URL 設給 Prisma CLI 子程序，所以 CLI 一定連到固定資料庫，
 * 而不是 .env 裡殘留的 file:./dev.db（那會讓新版資料夾建立／修改另一份資料庫）。
 *
 * 安全：
 * - 會改資料庫的指令（db push、migrate dev/deploy）執行前一律先自動備份。
 * - 永遠拒絕：migrate reset、db push --force-reset、--accept-data-loss。
 * - 請不要直接執行 `npx prisma …`（它會讀 .env，可能連到錯的資料庫）。
 */
import { spawnSync } from "child_process";
import path from "path";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";
import { runBackup } from "./backupCore";

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log("用法：npm run db:push | db:studio | db:migrate");
    process.exit(1);
  }
  const joined = args.join(" ");
  if (/\bmigrate\s+reset\b|--force-reset|--accept-data-loss/.test(joined)) {
    console.log("⛔ 這個指令會清除或重設資料，本專案的包裝一律拒絕。若真的需要，請先自行備份並直接聯絡維護者評估。");
    process.exit(1);
  }
  if (/(^|\s)--schema(\s|=)|schema\.postgres|postgres(ql)?:\/\//i.test(joined)) {
    console.log("⛔ 這個包裝只用於本機 SQLite：不接受 --schema 或資料庫連線字串參數（避免誤連 Neon／PostgreSQL）。");
    process.exit(1);
  }
  const cfg = loadConfigOrExit(); // 遠端模式會在這裡被拒絕
  console.log(describeConfig(cfg).join("\n") + "\n");
  const mutating = /^(db push|migrate (dev|deploy))/.test(joined);
  if (mutating && cfg.mode === "local") {
    const { prisma } = openPrisma(cfg);
    try {
      console.log("✅ 已先備份：" + (await runBackup(prisma, cfg, "before-" + args.slice(0, 2).join("-"))));
    } finally {
      await prisma.$disconnect();
    }
  }
  const cli = require.resolve("prisma/build/index.js", { paths: [process.cwd()] });
  const res = spawnSync(process.execPath, [cli, ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: cfg.dbUrl },
  });
  process.exit(res.status ?? 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
