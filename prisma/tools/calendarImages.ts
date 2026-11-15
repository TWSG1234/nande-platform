/**
 * npm run calendar:images -- <圖片資料夾>             → 只預覽（唯讀）：哪張圖會對到哪個節日
 * npm run calendar:images -- <圖片資料夾> --apply     → 先自動備份，再「只補沒有小圖的節日」（不覆蓋、不刪除）
 *
 * 圖檔檔名 = 節日名稱（例如 端午節.png）。圖片複製到固定資料夾 uploads/content/（新 UUID 檔名），
 * 來源資料夾的原檔不動。可重複執行：已有小圖的節日會略過。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";
import { runBackup } from "./backupCore";
import { planCalendarImages } from "./calendarImagesCore";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dirArg = args.find((a) => !a.startsWith("--"));
  if (!dirArg) {
    console.log("用法：npm run calendar:images -- <放節日圖的資料夾>   （加 --apply 才會寫入）");
    process.exit(1);
  }
  const dir = path.resolve(dirArg);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.log(`找不到資料夾：${dir}`);
    process.exit(1);
  }
  console.log(`=== 節日小圖批次對應（${apply ? "寫入模式：只補沒有小圖的節日" : "只預覽，不寫入"}）===`);
  const cfg = loadConfigOrExit();
  if (cfg.mode !== "local") {
    console.log("目前只支援本機 SQLite。");
    process.exit(1);
  }
  console.log(describeConfig(cfg).join("\n"));
  console.log("→ 這就是網站實際使用的資料庫。\n");

  const { prisma } = openPrisma(cfg);
  try {
    const cols = (await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("CalendarEvent")`)).map((r) => r.name);
    if (!cols.includes("imageUrl")) {
      console.log("❌ 資料庫還沒有 CalendarEvent.imageUrl 欄位。請先執行 npm run db:push（會自動備份、只新增一個欄位），再重跑這個指令。");
      process.exit(1);
    }
    const events = await prisma.$queryRawUnsafe<{ id: string; date: string; nameZh: string; imageUrl: string | null }[]>(
      `SELECT id, date, nameZh, imageUrl FROM "CalendarEvent"`
    );
    const files = readdirSync(dir).filter((f) => statSync(path.join(dir, f)).isFile());
    const plan = planCalendarImages(files, events);

    if (apply && plan.some((p) => p.kind === "assign")) {
      console.log(`✅ 已備份：${await runBackup(prisma, cfg, "before-calendar-images")}\n`);
    }
    let done = 0;
    for (const it of plan) {
      if (it.kind === "assign") {
        const ext = path.extname(it.file).toLowerCase();
        const src = path.join(dir, it.file);
        if (statSync(src).size > 10 * 1024 * 1024) {
          console.log(`  ⚠ ${it.file}：超過 10MB，略過`);
          continue;
        }
        console.log(`  ＋ ${apply ? "已" : "將會"}把「${it.file}」設為「${it.event.nameZh}」（${it.event.date}，編號 ${it.event.id}）的小圖`);
        if (apply) {
          const name = `${randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
          const to = path.join(cfg.uploadsDir!, "content", name);
          mkdirSync(path.dirname(to), { recursive: true });
          copyFileSync(src, to); // 新 UUID 檔名，不會覆蓋任何既有檔案
          // 只在 imageUrl 仍為空時寫入（避免覆蓋剛好同時在後台設好的圖）
          await prisma.$executeRawUnsafe(`UPDATE "CalendarEvent" SET imageUrl = ? WHERE id = ? AND (imageUrl IS NULL OR imageUrl = '')`, `/uploads/content/${name}`, it.event.id);
          done++;
        }
      } else if (it.kind === "skip-has-image") console.log(`  ✓ 「${it.event.nameZh}」已經有小圖，略過「${it.file}」（要更換請到後台）`);
      else if (it.kind === "no-match") console.log(`  ⚠ 「${it.file}」找不到名稱相同的節日（未處理）`);
      else if (it.kind === "ambiguous") console.log(`  ⚠ 「${it.file}」無法判斷：${it.reason}${it.candidates.length > 1 ? "；候選：" + it.candidates.map((c) => `${c.date} 編號 ${c.id}`).join("、") : ""}`);
      else console.log(`  ⚠ 「${it.file}」${it.reason}（略過）`);
    }
    const n = plan.filter((p) => p.kind === "assign").length;
    console.log(`\n===== 總結 =====\n${apply ? `已設定 ${done} 個節日的小圖` : `預覽：將設定 ${n} 個`}；其餘為略過或無法對應（見上方）。`);
    if (!apply && n > 0) console.log("確認沒問題後，加上 --apply 再執行一次（會先自動備份）。");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error("失敗：", e);
  process.exit(1);
});
