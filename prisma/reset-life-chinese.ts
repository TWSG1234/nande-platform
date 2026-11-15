/**
 * 重新處理「中文學習 → 生活」的關卡資料（乾淨覆蓋，不是在舊資料上追加）。
 *
 * 執行：
 *   npm run db:audit-life            只檢查、列出報告，不改任何資料（dry-run）
 *   npm run db:reset-life-vocabulary 先備份、再覆蓋生活 1～8 關的名稱與單字
 *
 * 生活區資料實際存放的位置（前台也是從這裡讀）：
 *   資料庫 ChineseStage（track = "life"）→ ChinesePage（單字／漫畫／題目頁）
 *     → ChineseVocabWord（單字）、ChineseQuestion（題目）
 *   前台：lib/serverData.ts 的 getChineseStages("life")／getChineseStageDetail()
 *   這份指令的資料來源：prisma/data/lifeVocabulary.ts（關卡名稱＋單字，使用者提供）
 *   （舊版的 ChineseCategory／ChineseLevel 是最早期的教材，前台已經不使用，不在這裡處理）
 *
 * 覆蓋規則（只處理 track="life"，校園完全不碰）：
 * 1. 先把生活區所有關卡、頁面、單字、題目備份成 JSON（prisma/backups/）。
 * 2. 每個關卡 1～8：
 *    - 用固定 id（chinese-stage-life-N）當正本；沒有才建立。名稱、順序、發布狀態以這次資料為準，
 *      英文關卡名稱清空（這次沒有提供英文名稱，避免殘留舊的錯誤英文）。
 *    - 這關所有「單字頁」裡的舊單字全部刪除，多出來的重複單字頁也刪除，只留一個單字頁，
 *      再照提供的順序重新建立單字（所以不會有舊的、重複的、錯誤的單字殘留）。
 * 3. 同一個等級出現重複的關卡：空的刪除；有內容的取消發布（不刪除），前台不會出現重複關卡。
 *    等級超出 1～8 的生活關卡：取消發布（不刪除）。
 * 4. 漫畫頁、題目頁（以及它們的答案）不屬於這次提供的資料，完全不動，只在報告裡列出數量。
 */
import { openPrisma, requireConfirm, describeConfig, loadConfigOrExit } from "./tools/dbClient";
import { mkdirSync, writeFileSync } from "fs";
import { LIFE_STAGES, cleanText, cleanPinyin } from "./data/lifeVocabulary";

requireConfirm("db:reset-life-vocabulary", "會刪除並重建生活區舊單字。", ['--dry-run']);
const { prisma } = openPrisma();
console.log("使用的資料庫：" + describeConfig(loadConfigOrExit()).join(" / "));
const DRY = process.argv.includes("--dry-run");

type WordRow = { id: string; hanzi: string; pinyin: string; english: string; order: number };
type QuestionRow = { id: string };
type PageRow = { id: string; type: string; order: number; words: WordRow[]; questions: QuestionRow[] };
type StageRow = {
  id: string;
  levelNumber: number;
  titleZh: string;
  titleEn: string;
  order: number;
  isPublished: boolean;
  pages: PageRow[];
};

async function loadLifeStages(): Promise<StageRow[]> {
  return (await prisma.chineseStage.findMany({
    where: { track: "life" },
    include: { pages: { orderBy: { order: "asc" }, include: { words: { orderBy: { order: "asc" } }, questions: true } } },
    orderBy: [{ levelNumber: "asc" }, { order: "asc" }],
  })) as StageRow[];
}

function summarize(stages: StageRow[], label: string) {
  console.log(`\n===== ${label} =====`);
  console.log(`生活關卡共 ${stages.length} 個`);
  const byLevel = new Map<number, StageRow[]>();
  for (const s of stages) byLevel.set(s.levelNumber, [...(byLevel.get(s.levelNumber) ?? []), s]);
  let totalWords = 0;
  for (const s of stages) {
    const count = (t: string) => s.pages.filter((p) => p.type === t).length;
    const words = s.pages.reduce((n, p) => n + p.words.length, 0);
    const questions = s.pages.reduce((n, p) => n + p.questions.length, 0);
    totalWords += words;
    // 同一頁裡中文重複的單字
    const dupInPage: string[] = [];
    for (const p of s.pages) {
      const seen = new Set<string>();
      for (const w of p.words) {
        const k = cleanText(w.hanzi);
        if (seen.has(k)) dupInPage.push(k);
        seen.add(k);
      }
    }
    console.log(
      `- 第 ${s.levelNumber} 關 [${s.id}] ${s.isPublished ? "已發布" : "草稿"}｜名稱「${s.titleZh || "(空)"}」｜` +
        `頁面：單字 ${count("vocabulary")}／漫畫 ${count("comic")}／題目頁 ${s.pages.length - count("vocabulary") - count("comic")}｜` +
        `單字 ${words} 個、題目 ${questions} 題` +
        (dupInPage.length ? `｜⚠ 單字頁內重複：${dupInPage.join("、")}` : "")
    );
  }
  const dupLevels = [...byLevel.entries()].filter(([, list]) => list.length > 1);
  const outOfRange = stages.filter((s) => s.levelNumber < 1 || s.levelNumber > 8);
  console.log(`單字總數：${totalWords}`);
  console.log(dupLevels.length ? `⚠ 重複的關卡等級：${dupLevels.map(([n, l]) => `第 ${n} 關 ×${l.length}`).join("、")}` : "沒有重複的關卡等級");
  console.log(outOfRange.length ? `⚠ 等級超出 1～8 的生活關卡：${outOfRange.map((s) => s.id).join("、")}` : "沒有超出 1～8 的生活關卡");
  return { dupLevels, outOfRange, totalWords };
}

async function main() {
  console.log(DRY ? "【dry-run：只檢查，不修改任何資料】" : "【正式執行：先備份，再覆蓋生活 1～8 關】");

  const before = await loadLifeStages();
  summarize(before, "執行前：目前資料庫裡的生活區資料");

  if (DRY) {
    console.log("\n（dry-run 結束，沒有修改任何資料。確認後再執行 npm run db:reset-life-vocabulary）");
    return;
  }

  // 1) 備份
  mkdirSync("prisma/backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `prisma/backups/life-chinese-${stamp}.json`;
  writeFileSync(backupPath, JSON.stringify(before, null, 2), "utf-8");
  console.log(`\n已備份生活區資料到 ${backupPath}`);

  let wordsDeleted = 0;
  let wordsCreated = 0;
  let extraVocabPagesDeleted = 0;
  const notes: string[] = [];

  // 2) 逐關覆蓋
  for (const data of LIFE_STAGES) {
    const n = data.level;
    const canonicalId = `chinese-stage-life-${n}`;
    const sameLevel = before.filter((s) => s.levelNumber === n);

    // 這一關的正本：優先固定 id；沒有就建立（不拿別的關卡改編號，避免誤傷）
    let canonical = sameLevel.find((s) => s.id === canonicalId);

    // 同等級的重複關卡
    for (const dup of sameLevel.filter((s) => s.id !== canonicalId)) {
      if (dup.pages.length === 0) {
        await prisma.chineseStage.delete({ where: { id: dup.id } });
        notes.push(`第 ${n} 關：刪除空的重複關卡 ${dup.id}`);
      } else {
        await prisma.chineseStage.update({ where: { id: dup.id }, data: { isPublished: false } });
        notes.push(`第 ${n} 關：重複關卡 ${dup.id} 有 ${dup.pages.length} 個頁面，未刪除，已取消發布（前台不再顯示）`);
      }
    }

    // tx 的型別是 Prisma 自動產生的交易用 client；這裡不另外標註，避免跟版本綁死。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      if (!canonical) {
        await tx.chineseStage.create({
          data: { id: canonicalId, track: "life", levelNumber: n, order: n, isPublished: true, titleZh: cleanText(data.titleZh), titleEn: "" },
        });
        canonical = { id: canonicalId, levelNumber: n, titleZh: "", titleEn: "", order: n, isPublished: true, pages: [] };
      } else {
        await tx.chineseStage.update({
          where: { id: canonicalId },
          data: { titleZh: cleanText(data.titleZh), titleEn: "", order: n, levelNumber: n, isPublished: true },
        });
      }

      const vocabPages = (canonical.pages ?? []).filter((p) => p.type === "vocabulary").sort((a, b) => a.order - b.order);
      let keep = vocabPages[0];
      for (const p of vocabPages) {
        const del = await tx.chineseVocabWord.deleteMany({ where: { pageId: p.id } });
        wordsDeleted += del.count;
      }
      for (const extra of vocabPages.slice(1)) {
        await tx.chinesePage.delete({ where: { id: extra.id } });
        extraVocabPagesDeleted++;
      }
      if (!keep) {
        const maxOrder = (canonical.pages ?? []).reduce((m, p) => Math.max(m, p.order), -1);
        const created = await tx.chinesePage.create({
          data: { id: `chinese-page-life-${n}-vocab`, stageId: canonicalId, type: "vocabulary", order: maxOrder + 1, isPublished: true },
        });
        keep = { id: created.id, type: "vocabulary", order: created.order, words: [], questions: [] };
      }

      await tx.chineseVocabWord.createMany({
        data: data.words.map(([h, p, e], i) => ({
          pageId: keep!.id,
          hanzi: cleanText(h),
          pinyin: cleanPinyin(p),
          english: cleanText(e),
          order: i,
        })),
      });
      wordsCreated += data.words.length;
    });
    console.log(`[life] 第 ${n} 關「${data.titleZh}」已覆蓋（${data.words.length} 個單字）`);
  }

  // 3) 超出 1～8 的生活關卡：取消發布，不刪
  for (const s of before.filter((s) => s.levelNumber < 1 || s.levelNumber > 8)) {
    await prisma.chineseStage.update({ where: { id: s.id }, data: { isPublished: false } });
    notes.push(`等級 ${s.levelNumber} 的生活關卡 ${s.id}：已取消發布（未刪除）`);
  }

  // 4) 執行後檢查
  const after = await loadLifeStages();
  summarize(after, "執行後：資料庫裡的生活區資料");

  const published = after.filter((s) => s.isPublished && s.levelNumber >= 1 && s.levelNumber <= 8);
  const wordsAfter = published.reduce(
    (n, s) => n + s.pages.filter((p) => p.type === "vocabulary").reduce((m, p) => m + p.words.length, 0),
    0
  );
  const expected = LIFE_STAGES.reduce((n, s) => n + s.words.length, 0);
  console.log("\n===== 結果 =====");
  console.log(`覆蓋掉的舊單字：${wordsDeleted} 筆；刪除多餘的單字頁：${extraVocabPagesDeleted} 個`);
  console.log(`重新匯入：${LIFE_STAGES.length} 個生活關卡、${wordsCreated} 個單字`);
  console.log(`最終已發布的生活 1～8 關：${published.length} 個；這些關卡的單字總數：${wordsAfter}（預期 ${expected}）`);
  console.log(wordsAfter === expected && published.length === 8 ? "✔ 數量完全符合" : "⚠ 數量與預期不同，請看上方「執行後」逐關明細");
  if (notes.length) console.log("\n[處理備註]\n" + notes.join("\n"));
  console.log(`\n備份檔：${backupPath}（需要還原時可以從這份 JSON 找回舊資料）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
