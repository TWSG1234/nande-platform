/**
 * 把「中文學習 → 生活」第 1～8 關的漫畫（中文版＋英文版）匯入資料庫。
 *
 * 執行：npm run db:import-life-comics
 *
 * 做法（沿用現有結構，不新增資料表）：
 *   生活第 N 關 = ChineseStage（id: chinese-stage-life-N）
 *     └─ 漫畫頁 = ChinesePage（type="comic"）
 *          ├─ comicImages   ＝ 中文版漫畫
 *          └─ comicImagesEn ＝ 英文版漫畫
 *
 * 對應關係完全由檔名決定（生活N_中文 / 生活N_英文），圖片已經整理成
 * 固定資料夾 uploads/content/life-comics/life-N-zh.png、life-N-en.png（內建原檔在 prisma/assets/uploads）。
 *
 * 安全性：
 * - 只動「生活」的 1～8 關，不碰校園。
 * - 這一關如果已經有漫畫頁，就直接替換它的圖片（不會再多建一個，所以不會出現兩份
 *   漫畫）；沒有才新建。這一關的其他頁面（單字、題目…）完全不動。
 * - 這是獨立的匯入指令，不放在 db:seed 裡——之後你在後台換掉某關的漫畫，
 *   就算重跑 db:seed 也不會被這批圖蓋回去。
 */
import { openPrisma, requireConfirm, describeConfig, loadConfigOrExit } from "./tools/dbClient";

requireConfirm("db:import-life-comics", "會把生活 1～8 關漫畫圖片換成內建圖片（覆蓋你在後台換過的）。", []);
const { prisma } = openPrisma();
console.log("使用的資料庫：" + describeConfig(loadConfigOrExit()).join(" / "));

const W = 1200;
const H = 1400;

async function main() {
  for (let level = 1; level <= 8; level++) {
    const stageId = `chinese-stage-life-${level}`;
    const zh = [{ url: `/uploads/content/life-comics/life-${level}-zh.png`, width: W, height: H }];
    const en = [{ url: `/uploads/content/life-comics/life-${level}-en.png`, width: W, height: H }];

    // 關卡本身（正常情況 db:seed 已經建好；這裡只是保險，不會覆蓋既有資料）
    await prisma.chineseStage.upsert({
      where: { id: stageId },
      update: {},
      create: { id: stageId, track: "life", levelNumber: level, order: level, isPublished: true },
    });

    const comicPages = await prisma.chinesePage.findMany({
      where: { stageId, type: "comic" },
      orderBy: { order: "asc" },
    });

    if (comicPages.length > 0) {
      await prisma.chinesePage.update({
        where: { id: comicPages[0]!.id },
        data: {
          comicImages: JSON.stringify(zh),
          comicImagesEn: JSON.stringify(en),
          allowFlip: true,
          isPublished: true,
        },
      });
      console.log(
        `[life-comics] 生活第 ${level} 關：已替換既有漫畫頁（${comicPages[0]!.id}）的中英文圖片` +
          (comicPages.length > 1 ? `；注意這一關原本有 ${comicPages.length} 個漫畫頁，只更新了第一個` : "")
      );
    } else {
      const others = await prisma.chinesePage.findMany({ where: { stageId }, orderBy: { order: "asc" }, take: 1 });
      const order = others.length > 0 ? others[0]!.order - 1 : 0; // 漫畫放在這一關最前面
      await prisma.chinesePage.create({
        data: {
          id: `chinese-page-life-${level}-comic`,
          stageId,
          type: "comic",
          order,
          isPublished: true,
          comicImages: JSON.stringify(zh),
          comicImagesEn: JSON.stringify(en),
          allowFlip: true,
        },
      });
      console.log(`[life-comics] 生活第 ${level} 關：新建漫畫頁並放入中英文圖片`);
    }
  }
  console.log("[life-comics] 完成：生活 1～8 關漫畫已匯入。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
