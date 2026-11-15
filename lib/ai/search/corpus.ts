/**
 * 伺服器端：讀取「一般訪客看得到」的已發布資料，組成可搜尋的文件。
 * - 只用唯讀查詢（findMany）；沒有任何寫入。
 * - 生活／校園／行事曆沿用 serverData 的讀取函式（只含已發布；資料庫沒資料時沿用網站一樣的備用內容）。
 * - 中文學習：只讀已發布的關卡、頁面、題目。
 * - 知識：只讀 status="approved" 且 isActive=true。投稿（AssistantQuestion）完全不會被讀進來。
 * - 每次搜尋都重新讀取，所以停用或修改知識後馬上生效（沒有快取）。
 * - 不會讀取管理員帳號、設定、密碼、未發布內容。
 */
import { prisma } from "@/lib/prisma";
import { getCalendarEvents, getCampusSpots, getLifeCategories } from "@/lib/serverData";
import { getAssistantRules } from "@/lib/ai/assistantData";
import { buildDocs, type ChineseStageForSearch, type KnowledgeForSearch } from "./docs";
import type { SearchDoc } from "./engine";

async function loadStages(): Promise<ChineseStageForSearch[]> {
  try {
    const rows = await prisma.chineseStage.findMany({
      where: { isPublished: true },
      orderBy: [{ track: "asc" }, { order: "asc" }, { levelNumber: "asc" }],
      include: {
        pages: {
          where: { isPublished: true },
          orderBy: { order: "asc" },
          include: { words: { orderBy: { order: "asc" } }, questions: { where: { isPublished: true }, orderBy: { order: "asc" } } },
        },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      track: s.track === "campus" ? "campus" : "life",
      levelNumber: s.levelNumber,
      titleZh: s.titleZh,
      titleEn: s.titleEn || s.titleZh,
      words: s.pages.flatMap((p) => p.words.map((w) => ({ hanzi: w.hanzi, pinyin: w.pinyin, english: w.english }))),
      pageTitles: s.pages.map((p) => p.titleZh).filter(Boolean),
      prompts: s.pages.flatMap((p) => p.questions.map((q) => ({ zh: q.promptZh, en: q.promptEn || q.promptZh }))),
    }));
  } catch (err) {
    console.error("[assistant-search] 中文學習資料讀取失敗，略過：", err);
    return [];
  }
}

export async function loadKnowledge(): Promise<KnowledgeForSearch[]> {
  try {
    const rows = await prisma.assistantKnowledge.findMany({ where: { status: "approved", isActive: true } });
    return rows.map((k) => ({
      id: k.id,
      question: k.standardQuestion,
      questionEn: k.questionEn,
      answerZh: k.answerZh,
      answerEn: k.answerEn,
      synonyms: k.synonyms,
      category: k.category,
      sourceUrl: k.sourceUrl || null,
    }));
  } catch {
    // 資料表還沒建立（尚未執行 npm run db:push）：沒有知識，其他搜尋照常
    return [];
  }
}

export async function loadCorpus(): Promise<SearchDoc[]> {
  const [life, campus, events, stages, knowledge, rules] = await Promise.all([
    getLifeCategories(),
    getCampusSpots(),
    getCalendarEvents(),
    loadStages(),
    loadKnowledge(),
    getAssistantRules(),
  ]);
  return buildDocs({
    life,
    campus,
    events,
    stages,
    knowledge,
    rules: rules.filter((r) => r.enabled).map((r) => ({ id: r.id, keywords: r.keywords, replyZh: r.replyZh, replyEn: r.replyEn })),
  });
}
