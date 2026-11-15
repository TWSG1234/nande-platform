/**
 * 把網站資料（已經是「一般訪客看得到」的已發布資料）轉成可搜尋的文件。純轉換，不連資料庫。
 */
import type { CalendarEvent, CampusSpot, LifeCategory, Localized } from "@/lib/types";
import type { SearchDoc } from "./engine";

const z = (l?: Localized | null) => l?.["zh-TW"] ?? "";
const e = (l?: Localized | null) => l?.en || l?.["zh-TW"] || "";

export interface ChineseStageForSearch {
  id: string;
  track: "life" | "campus";
  levelNumber: number;
  titleZh: string;
  titleEn: string;
  words: { hanzi: string; pinyin: string; english: string }[];
  pageTitles: string[];
  prompts: { zh: string; en: string }[];
}

export interface KnowledgeForSearch {
  id: string;
  question: string;
  questionEn: string;
  answerZh: string;
  answerEn: string;
  synonyms: string;
  category: string;
  sourceUrl: string | null;
}

export interface RuleForSearch {
  id: string;
  keywords: string;
  replyZh: string;
  replyEn: string;
}

export const KNOWLEDGE_CATEGORY_LABEL: Record<string, { zh: string; en: string }> = {
  life: { zh: "生活", en: "Life" },
  campus: { zh: "校園", en: "Campus" },
  transport: { zh: "交通", en: "Transportation" },
  chinese: { zh: "中文學習", en: "Chinese Learning" },
  culture: { zh: "台灣文化", en: "Taiwan Culture" },
  other: { zh: "其他", en: "Other" },
};

const SOURCE_URL_OK = /^(\/[A-Za-z0-9\-._~/%?=&#]*|https:\/\/[^\s]+)$/;
/** 站內路徑或 https 連結才可作為連結；其他一律不顯示連結。 */
export function safeLink(u: string | null | undefined): string | undefined {
  const s = (u ?? "").trim();
  return s && !s.startsWith("//") && SOURCE_URL_OK.test(s) ? s : undefined;
}

export function buildDocs(input: {
  life: LifeCategory[];
  campus: CampusSpot[];
  events: CalendarEvent[];
  stages: ChineseStageForSearch[];
  knowledge: KnowledgeForSearch[];
  rules: RuleForSearch[];
}): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const cat of input.life) {
    for (const item of cat.items) {
      docs.push({
        id: `life:${item.id}`,
        kind: "life",
        categoryZh: `生活座標・${z(cat.name)}`,
        categoryEn: `Life Guide · ${e(cat.name)}`,
        titleZh: z(item.title),
        titleEn: e(item.title),
        bodyZh: z(item.detail),
        bodyEn: e(item.detail),
        extraZh: [z(item.fullDetail), z(item.tip), z(cat.description)].filter(Boolean).join("\n"),
        extraEn: [e(item.fullDetail), e(item.tip), e(cat.description)].filter(Boolean).join("\n"),
        tags: [z(cat.name), e(cat.name)],
        url: `/life/${item.id}`,
      });
    }
  }

  for (const s of input.campus) {
    const times = (s.schoolTimes ?? []).map((t) => `${t.school} ${t.time}`).join("\n");
    const encounter = (s.exchangeStudentMayEncounter ?? []).map(z).join("\n");
    const encounterEn = (s.exchangeStudentMayEncounter ?? []).map(e).join("\n");
    const unit = s.category === "school-units";
    docs.push({
      id: `campus:${s.id}`,
      kind: "campus",
      categoryZh: unit ? "校園座標・校內單位" : "校園座標・校園文化",
      categoryEn: unit ? "Campus Guide · School Offices" : "Campus Guide · School Culture",
      titleZh: z(s.name),
      titleEn: e(s.name),
      bodyZh: z(s.description),
      bodyEn: e(s.description),
      extraZh: [z(s.details), z(s.hours), times, z(s.tips), z(s.mainResponsibility), encounter].filter(Boolean).join("\n"),
      extraEn: [e(s.details), e(s.hours), times, e(s.tips), e(s.mainResponsibility), encounterEn].filter(Boolean).join("\n"),
      tags: [unit ? "校內單位 處室" : "校園文化 學校", unit ? "school office" : "school culture"],
      url: `/campus/${s.id}`,
    });
  }

  for (const ev of input.events) {
    const customs = (ev.taiwanCustoms ?? []).map(z).join("\n");
    const customsEn = (ev.taiwanCustoms ?? []).map(e).join("\n");
    docs.push({
      id: `calendar:${ev.id}`,
      kind: "calendar",
      categoryZh: "台灣行事曆",
      categoryEn: "Taiwan Calendar",
      titleZh: z(ev.name),
      titleEn: e(ev.name),
      bodyZh: `${ev.date}　${z(ev.description)}`,
      bodyEn: `${ev.date}　${e(ev.description)}`,
      extraZh: [z(ev.origin), customs, z(ev.tag)].filter(Boolean).join("\n"),
      extraEn: [e(ev.origin), customsEn, e(ev.tag)].filter(Boolean).join("\n"),
      tags: [ev.isHoliday ? "放假 節日 holiday" : "紀念日 memorial"],
      url: "/calendar",
    });
  }

  for (const st of input.stages) {
    const trackZh = st.track === "life" ? "生活" : "校園";
    const words = st.words.map((w) => `${w.hanzi} ${w.pinyin} ${w.english}`).join("\n");
    docs.push({
      id: `chinese:${st.id}`,
      kind: "chinese",
      categoryZh: `中文學習・${trackZh}`,
      categoryEn: `Chinese Learning · ${st.track === "life" ? "Life" : "Campus"}`,
      titleZh: st.titleZh ? `${trackZh}第 ${st.levelNumber} 關：${st.titleZh}` : `${trackZh}第 ${st.levelNumber} 關`,
      titleEn: st.titleEn ? `${st.track === "life" ? "Life" : "Campus"} Level ${st.levelNumber}: ${st.titleEn}` : `${st.track === "life" ? "Life" : "Campus"} Level ${st.levelNumber}`,
      bodyZh: st.words.length ? `這一關的單字：${st.words.map((w) => w.hanzi).join("、")}` : `${trackZh}情境的中文學習關卡`,
      bodyEn: st.words.length ? `Vocabulary: ${st.words.map((w) => `${w.hanzi} (${w.english})`).join(", ")}` : "Chinese learning level",
      extraZh: [words, st.pageTitles.join("\n"), st.prompts.map((p) => p.zh).join("\n")].filter(Boolean).join("\n"),
      extraEn: [st.prompts.map((p) => p.en).join("\n")].filter(Boolean).join("\n"),
      tags: ["中文學習 單字 漫畫 Chinese vocabulary"],
      url: `/chinese/${st.track}/${st.id}`,
    });
  }

  for (const k of input.knowledge) {
    const cat = KNOWLEDGE_CATEGORY_LABEL[k.category] ?? KNOWLEDGE_CATEGORY_LABEL.other!;
    docs.push({
      id: `knowledge:${k.id}`,
      kind: "knowledge",
      categoryZh: `常見問題・${cat.zh}`,
      categoryEn: `FAQ · ${cat.en}`,
      titleZh: k.question,
      titleEn: k.questionEn || k.question,
      bodyZh: k.answerZh,
      bodyEn: k.answerEn || k.answerZh,
      tags: k.synonyms.split(/[\n,，、;；]+/).map((s) => s.trim()).filter(Boolean),
      url: safeLink(k.sourceUrl),
    });
  }

  for (const r of input.rules) {
    const kws = r.keywords.split(/[\n,，、;；]+/).map((s) => s.trim()).filter(Boolean);
    docs.push({
      id: `rule:${r.id}`,
      kind: "rule",
      categoryZh: "威洛常見回覆",
      categoryEn: "Willow quick answers",
      titleZh: kws.slice(0, 3).join("、"),
      titleEn: kws.slice(0, 3).join(", "),
      bodyZh: "",
      bodyEn: "",
      answerZh: r.replyZh,
      answerEn: r.replyEn || r.replyZh,
      tags: kws,
    });
  }
  return docs;
}
