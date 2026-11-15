/**
 * npm run db:restore-life            → 只比對（預設，唯讀），印出「缺什麼、哪裡不一樣」
 * npm run db:restore-life -- --apply → 先自動備份，再「只補缺的」寫入（不覆蓋、不刪除）
 *
 * 資料來源：prisma/data/lifeVocabulary.ts（單字與關卡名稱）、
 *          固定上傳資料夾的 content/life-comics/life-N-{zh,en}.png（漫畫；缺的會從 prisma/assets 補，不覆蓋）。
 * 連線的資料庫 = 網站實際使用的固定資料庫（見 lib/config/dataConfig.ts），並會把路徑印出來讓你確認。
 */
import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { LIFE_STAGES } from "../data/lifeVocabulary";
import { restoreLife, type Store } from "./restoreLifeCore";
import { describeConfig, loadConfigOrExit, openPrisma } from "./dbClient";
import { runBackup } from "./backupCore";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`=== 生活區資料比對／恢復（${apply ? "寫入模式：只補缺" : "只比對，不寫入"}）===`);
  const cfg = loadConfigOrExit();
  if (cfg.mode !== "local") {
    console.log("目前只支援本機 SQLite。");
    process.exit(1);
  }
  console.log(describeConfig(cfg).join("\n"));
  console.log("→ 這就是網站實際使用的資料庫。\n");
  const uploads = cfg.uploadsDir!;
  const assets = path.join(process.cwd(), "prisma", "assets", "uploads");

  const { prisma } = openPrisma(cfg);
  try {
    const tables = new Set((await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM sqlite_master WHERE type='table'`)).map((r) => r.name));
    const need = ["ChineseStage", "ChinesePage", "ChineseVocabWord", "ChineseQuestion"];
    const lack = need.filter((t) => !tables.has(t));
    if (lack.length) {
      console.log(`❌ 資料庫缺少資料表：${lack.join("、")}。這是結構落後，不是資料遺失；請先看 npm run db:doctor 的說明，結構補齊前不寫入。`);
      process.exit(1);
    }
    const cols = (await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("ChinesePage")`)).map((r) => r.name);
    const lackCols = ["comicImages", "comicImagesEn", "allowFlip"].filter((c) => !cols.includes(c));
    if (lackCols.length) {
      console.log(`❌ ChinesePage 缺少欄位：${lackCols.join("、")}。結構落後，請先處理（見 db:doctor），停止。`);
      process.exit(1);
    }

    if (apply) {
      const target = await runBackup(prisma, cfg, "before-restore-life");
      console.log(`✅ 已備份：${target}`);
      // 內建漫畫圖片：固定上傳資料夾裡「沒有」才複製，已存在的一律不動。
      let copied = 0;
      for (let n = 1; n <= 8; n++) {
        for (const g of ["zh", "en"]) {
          const rel = path.join("content", "life-comics", `life-${n}-${g}.png`);
          const from = path.join(assets, rel);
          const to = path.join(uploads, rel);
          if (existsSync(from) && !existsSync(to)) {
            mkdirSync(path.dirname(to), { recursive: true });
            copyFileSync(from, to);
            copied++;
          }
        }
      }
      console.log(`圖片：補上缺少的內建漫畫圖 ${copied} 張（已存在的不覆蓋）\n`);
    }

    const store: Store = {
      getStage: async (id) => {
        const r = await prisma.chineseStage.findUnique({ where: { id } });
        return r && { id: r.id, titleZh: r.titleZh, isPublished: r.isPublished };
      },
      listPages: async (stageId) =>
        (await prisma.chinesePage.findMany({ where: { stageId } })).map((p) => ({
          id: p.id, stageId: p.stageId, type: p.type, order: p.order, isPublished: p.isPublished,
          comicImages: p.comicImages, comicImagesEn: p.comicImagesEn, allowFlip: p.allowFlip,
        })),
      listWords: async (pageId) =>
        (await prisma.chineseVocabWord.findMany({ where: { pageId }, orderBy: { order: "asc" } })).map((w) => ({
          id: w.id, pageId: w.pageId, hanzi: w.hanzi, pinyin: w.pinyin, english: w.english, order: w.order,
        })),
      countQuestions: (stageId) => prisma.chineseQuestion.count({ where: { page: { stageId } } }),
      createStage: async ({ id, level, titleZh }) => {
        await prisma.chineseStage.create({ data: { id, track: "life", levelNumber: level, order: level, isPublished: true, titleZh } });
      },
      setStageTitle: async (id, titleZh) => {
        await prisma.chineseStage.update({ where: { id }, data: { titleZh } });
      },
      createPage: async (r) => {
        await prisma.chinesePage.create({
          data: { id: r.id, stageId: r.stageId, type: r.type, order: r.order, isPublished: r.isPublished, comicImages: r.comicImages, comicImagesEn: r.comicImagesEn, allowFlip: r.allowFlip },
        });
      },
      setComicFields: async (id, f) => {
        await prisma.chinesePage.update({ where: { id }, data: f });
      },
      createWord: async (r) => {
        await prisma.chineseVocabWord.create({ data: r });
      },
    };

    const res = await restoreLife(store, LIFE_STAGES, {
      apply,
      fileExists: (u) => existsSync(path.join(uploads, u.replace(/^\/uploads\//, "")))
        || (!apply && existsSync(path.join(assets, u.replace(/^\/uploads\//, "")))),
    });
    console.log(res.lines.join("\n"));
    const s = res.summary;
    console.log(`\n===== 總結 =====`);
    console.log(`${apply ? "已" : "將會"}建立關卡 ${s.stagesCreated}、補關卡名稱 ${s.titlesFilled}、建立漫畫頁 ${s.comicPagesCreated}、補漫畫 ${s.comicsFilled}、建立單字頁 ${s.vocabPagesCreated}、新增單字 ${s.wordsAdded}`);
    console.log(`已存在且對上的單字 ${s.wordsAlreadyOk}／與 ZIP 不同但保留現有的項目 ${s.differences}／提醒 ${s.notes}`);
    if (!apply && (s.stagesCreated + s.titlesFilled + s.comicPagesCreated + s.comicsFilled + s.vocabPagesCreated + s.wordsAdded) > 0) {
      console.log("\n以上是預覽。確認沒問題後執行：npm run db:restore-life -- --apply（會先自動備份）");
    } else if (!apply) {
      console.log("\n沒有缺少的項目，不需要寫入。");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("失敗：", e);
  process.exit(1);
});
