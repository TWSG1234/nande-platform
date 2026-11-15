/**
 * 更新「中文學習 → 生活」第 1～8 關的關卡名稱與單字。
 *
 * 執行：npm run db:import-life-vocabulary
 * 資料內容在 prisma/data/lifeVocabulary.ts（照提供的順序、英文原樣保留）。
 *
 * 做法（沿用現有結構，不新增資料表、不改 schema）：
 *   ChineseStage（生活第 N 關，id: chinese-stage-life-N）→ 更新 titleZh
 *     └─ ChinesePage（type="vocabulary"）→ 沒有就建立，有就沿用
 *          └─ ChineseVocabWord（hanzi / pinyin / english / order）
 *
 * 安全性：
 * - 一律用 stageId 找關卡，只處理 track="life" 的 1～8 關，不碰校園。
 * - 同一頁裡中文相同的單字 → 更新那一筆，不重複建立；沒有才新增。
 * - 這一頁原本有、但這次名單裡沒有的舊單字：不刪除、不猜測，排在新單字後面，
 *   並在最後列出來給你判斷。
 * - 單字順序 = 提供的順序（order 0,1,2…），不重新排序。
 * - 只動關卡名稱（titleZh）與單字頁；漫畫頁、題目頁、英文關卡名稱等其他資料不動。
 */
import { openPrisma, requireConfirm, describeConfig, loadConfigOrExit } from "./tools/dbClient";
import { LIFE_STAGES } from "./data/lifeVocabulary";

requireConfirm("db:import-life-vocabulary", "會更新生活 1～8 關的名稱與已存在單字（覆蓋你在後台改過的）。", []);
const { prisma } = openPrisma();
console.log("使用的資料庫：" + describeConfig(loadConfigOrExit()).join(" / "));

type ExistingWord = { id: string; hanzi: string; pinyin: string; english: string; order: number };

/** 清理格式：去頭尾空白、連續空白合一、拿掉不該存進欄位的括號與星號、「/」前後統一一個空格。 */
function clean(raw: string): string {
  return raw
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}
function cleanPinyin(raw: string): string {
  // 拼音不要帶外層括號，例如 "(nǐ hǎo)" → "nǐ hǎo"
  return clean(raw).replace(/^[(（]\s*/, "").replace(/\s*[)）]$/, "");
}

async function main() {
  let stagesUpdated = 0;
  let wordsCreated = 0;
  let wordsUpdated = 0;
  const leftovers: string[] = [];
  const duplicates: string[] = [];
  const mismatches: string[] = [];

  for (const stage of LIFE_STAGES) {
    const stageId = `chinese-stage-life-${stage.level}`;

    // 1) 關卡名稱：直接更新既有 Level，沒有才建立（不會因為改名而多出新關卡）
    await prisma.chineseStage.upsert({
      where: { id: stageId },
      update: { titleZh: clean(stage.titleZh) },
      create: {
        id: stageId,
        track: "life",
        levelNumber: stage.level,
        order: stage.level,
        isPublished: true,
        titleZh: clean(stage.titleZh),
      },
    });
    stagesUpdated++;

    // 2) 單字頁：沿用這一關第一個單字頁，沒有才新建（放在這一關所有頁面的最後）
    let vocabPage = await prisma.chinesePage.findFirst({
      where: { stageId, type: "vocabulary" },
      orderBy: { order: "asc" },
    });
    if (!vocabPage) {
      const last = await prisma.chinesePage.findFirst({ where: { stageId }, orderBy: { order: "desc" } });
      vocabPage = await prisma.chinesePage.create({
        data: {
          id: `chinese-page-life-${stage.level}-vocab`,
          stageId,
          type: "vocabulary",
          order: last ? last.order + 1 : 0,
          isPublished: true,
        },
      });
    }

    // 3) 單字：以「這一頁 + 中文」判斷是不是同一筆
    const existing: ExistingWord[] = await prisma.chineseVocabWord.findMany({
      where: { pageId: vocabPage.id },
      orderBy: { order: "asc" },
    });
    const usedIds = new Set<string>();

    for (const [i, [rawHanzi, rawPinyin, rawEnglish]] of stage.words.entries()) {
      const hanzi = clean(rawHanzi);
      const pinyin = cleanPinyin(rawPinyin);
      const english = clean(rawEnglish);
      const matches = existing.filter((w) => clean(w.hanzi) === hanzi && !usedIds.has(w.id));
      const target = matches[0];
      if (target) {
        usedIds.add(target.id);
        await prisma.chineseVocabWord.update({ where: { id: target.id }, data: { hanzi, pinyin, english, order: i } });
        wordsUpdated++;
        for (const extra of matches.slice(1)) {
          usedIds.add(extra.id);
          duplicates.push(`生活第 ${stage.level} 關：「${hanzi}」資料庫裡有重複的 ${extra.id}（沒有刪除，請你確認）`);
          await prisma.chineseVocabWord.update({ where: { id: extra.id }, data: { order: 1000 + i } });
        }
      } else {
        await prisma.chineseVocabWord.create({ data: { pageId: vocabPage.id, hanzi, pinyin, english, order: i } });
        wordsCreated++;
      }
    }

    // 舊資料裡不在這次名單的單字：不刪、不猜，排到後面並列出來
    let tail = stage.words.length;
    for (const w of existing) {
      if (usedIds.has(w.id)) continue;
      await prisma.chineseVocabWord.update({ where: { id: w.id }, data: { order: tail++ } });
      leftovers.push(`生活第 ${stage.level} 關：「${w.hanzi}」（${w.pinyin} / ${w.english}）`);
    }

    const total = await prisma.chineseVocabWord.count({ where: { pageId: vocabPage.id } });
    const expected = stage.words.length;
    if (total !== expected + leftoverCount(existing, usedIds)) {
      mismatches.push(`生活第 ${stage.level} 關：資料庫 ${total} 筆，預期 ${expected} 筆`);
    }
    console.log(`[life-vocab] 第 ${stage.level} 關「${stage.titleZh}」：名單 ${expected} 個單字已寫入（頁面 ${vocabPage.id}）`);
  }

  // 最終檢查：只計算生活區各關「名單內」單字
  const lifeWords = await prisma.chineseVocabWord.count({
    where: { page: { stage: { track: "life", levelNumber: { gte: 1, lte: 8 } } } },
  });
  const listed = LIFE_STAGES.reduce((n, s) => n + s.words.length, 0);

  console.log("\n===== 結果 =====");
  console.log(`更新關卡：${stagesUpdated} 個`);
  console.log(`新建單字：${wordsCreated}　更新單字：${wordsUpdated}`);
  console.log(`這次名單單字總數：${listed}　資料庫生活區單字總數：${lifeWords}`);
  if (lifeWords !== listed) console.log("⚠ 兩個數字不同：代表生活區還有不在這次名單裡的舊單字（見下方清單）。");
  if (leftovers.length) console.log("\n[不在這次名單的舊單字（未刪除，已排到該關最後）]\n" + leftovers.join("\n"));
  if (duplicates.length) console.log("\n[重複資料（未刪除）]\n" + duplicates.join("\n"));
  if (mismatches.length) console.log("\n[數量不符]\n" + mismatches.join("\n"));
}

function leftoverCount(existing: { id: string }[], used: Set<string>) {
  return existing.filter((w) => !used.has(w.id)).length;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
