/**
 * 把搜尋結果組成威洛的回覆（文字 + 候選項目）。純函式。
 * 原則：只呈現網站資料庫裡真的有的內容；沒有可靠資料時明說，並分清楚「網站已有資訊」和「一般提醒」。
 */
import type { AssistantLang } from "../types";
import { classifyLifeTopic, type LifeTopic } from "../topic";
import { normalize, queryTerms } from "./normalize";
import type { DocKind, ScoredDoc, SearchDoc, SearchOutcome } from "./engine";

export interface SearchCandidate {
  id: string;
  kind: DocKind;
  title: string;
  category: string;
  summary: string;
  /** 站內連結；沒有適當頁面就沒有這個欄位 */
  url?: string;
  /** 相關程度（內部指標，不是 AI 信心） */
  level: "high" | "medium" | "low";
  /** 沒有直接命中，是「同分類擴大搜尋」列入的 */
  expanded?: boolean;
}

export interface SectionLink {
  label: string;
  url: string;
}

export interface AssistantAnswer {
  text: string;
  mode: SearchOutcome["mode"];
  /** "fallback"＝網站目前沒有任何相關資料（頭像顯示「暫時無法解決」）；其他都是有答案 */
  kind: "rule" | "fallback";
  topic: LifeTopic | null;
  candidates: SearchCandidate[];
  suggestions: SectionLink[];
  /** 高度相關時，第一項之後的「其他可能相關」小標題 */
  moreLabel?: string;
}

const T = {
  "zh-TW": {
    high: "我在網站上找到這項資訊：",
    highMore: "也許你還想看看：",
    candidates: "我找到幾項可能對你有幫助的資訊，點開看看：",
    related: "沒有找到完全符合的內容，不過這幾項相關資料也許有幫助：",
    none: "目前網站上還沒有這個問題的直接答案。你可以先從下面的區域逛逛，或把問題提交給我們，管理員整理後威洛就能回答喔！",
    note: "以上內容來自網站已收錄的資料；實際班次、票價、營業時間等請以官方最新資訊為準。",
    exampleHint: "你也可以這樣問：「公車怎麼搭」「午休是幾點」「端午節是哪一天」。",
    sections: [["生活座標", "/life"], ["校園座標", "/campus"], ["台灣行事曆", "/calendar"], ["中文學習", "/chinese"]] as [string, string][],
  },
  en: {
    high: "Here is what I found on the website:",
    highMore: "You might also want to look at:",
    candidates: "I found a few things that might help. Take a look:",
    related: "I couldn't find an exact match, but these related items might help:",
    none: "The website doesn't have a direct answer to this yet. Try browsing the sections below, or submit your question and an admin can add an answer for Willow!",
    note: "This comes from information already on the website. For schedules, prices, and opening hours, please check the latest official information.",
    exampleHint: 'You could also ask: "How do I take the bus?", "What time is the midday rest?", "When is Dragon Boat Festival?"',
    sections: [["Life Guide", "/life"], ["Campus Guide", "/campus"], ["Taiwan Calendar", "/calendar"], ["Chinese Learning", "/chinese"]] as [string, string][],
  },
} as const;

const KIND_TOPIC: Partial<Record<DocKind, LifeTopic>> = { life: "daily", campus: "campus", calendar: "culture" };
const KNOWLEDGE_TOPIC: Record<string, LifeTopic | null> = { life: "daily", campus: "campus", transport: "transport", culture: "culture", chinese: null, other: null };

const pickLang = (zh: string, en: string, lang: AssistantLang) => (lang === "en" ? en || zh : zh || en);

/** 取最貼近問題的一小段（句子）當摘要；沒有就取開頭。只用資料裡真實存在的文字。 */
export function snippet(text: string, query: string, max = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.split(/(?<=[。！？!?；;])\s*|\n/).map((s) => s.trim()).filter(Boolean);
  const terms = queryTerms(query).filter((t) => t.w >= 1).map((t) => t.term);
  let best = sentences[0] ?? clean;
  let bestHits = -1;
  for (const s of sentences) {
    const n = normalize(s);
    const hits = terms.filter((t) => n.includes(t)).length;
    if (hits > bestHits) {
      best = s;
      bestHits = hits;
    }
  }
  return best.length > max ? best.slice(0, max).replace(/[，、,\s]+$/, "") + "…" : best;
}

function level(r: ScoredDoc): SearchCandidate["level"] {
  return r.relevance >= 0.7 ? "high" : r.relevance >= 0.35 ? "medium" : "low";
}

export function toCandidate(r: ScoredDoc, query: string, lang: AssistantLang): SearchCandidate {
  const d = r.doc;
  const body = d.kind === "rule" ? pickLang(d.answerZh ?? "", d.answerEn ?? "", lang) : pickLang(d.bodyZh, d.bodyEn, lang);
  const c: SearchCandidate = {
    id: d.id,
    kind: d.kind,
    title: pickLang(d.titleZh, d.titleEn, lang),
    category: pickLang(d.categoryZh, d.categoryEn, lang),
    summary: snippet(body, query),
    level: level(r),
  };
  if (d.url) c.url = d.url;
  if (r.viaExpansion) c.expanded = true;
  return c;
}

/** 使用者選了某個候選項目時，頭像要不要顯示「生活資訊」：依該項目的類型與標題判斷。 */
export function topicForCandidate(c: { kind: DocKind; title: string; category: string }): LifeTopic | null {
  return classifyLifeTopic(`${c.title} ${c.category}`) ?? KIND_TOPIC[c.kind] ?? null;
}

export function topicFor(question: string, top: SearchDoc | undefined): LifeTopic | null {
  const byQuestion = classifyLifeTopic(question);
  if (byQuestion) return byQuestion;
  if (!top) return null;
  if (top.kind === "knowledge") {
    const key = top.categoryZh.includes("交通") ? "transport" : top.categoryZh.includes("校園") ? "campus" : top.categoryZh.includes("文化") ? "culture" : top.categoryZh.includes("中文") ? "chinese" : top.categoryZh.includes("生活") ? "life" : "other";
    return KNOWLEDGE_TOPIC[key] ?? null;
  }
  return KIND_TOPIC[top.kind] ?? null;
}

export function composeAnswer(question: string, lang: AssistantLang, outcome: SearchOutcome): AssistantAnswer {
  const t = T[lang];
  const suggestions = t.sections.map(([label, url]) => ({ label, url }));

  if (outcome.mode === "none" || outcome.results.length === 0) {
    return { text: `${t.none}\n${t.exampleHint}`, mode: "none", kind: "fallback", topic: null, candidates: [], suggestions };
  }

  const top = outcome.results[0]!;
  const topic = topicFor(question, top.doc);

  // 威洛常見回覆（管理員寫好的整句回覆）直接說出來，不用卡片
  if (outcome.mode === "high" && top.doc.kind === "rule") {
    const text = pickLang(top.doc.answerZh ?? "", top.doc.answerEn ?? "", lang);
    if (text.trim()) return { text, mode: "high", kind: "rule", topic, candidates: [], suggestions: [] };
  }

  const candidates = outcome.results.filter((r) => !(r.doc.kind === "rule" && !(r.doc.answerZh || r.doc.answerEn))).map((r) => toCandidate(r, question, lang));
  const lead = outcome.mode === "high" ? t.high : outcome.mode === "candidates" ? t.candidates : t.related;
  const text = `${lead}${candidates.some((c) => c.kind !== "knowledge" && c.kind !== "rule") ? `\n${t.note}` : ""}`;
  return { text, mode: outcome.mode, kind: "rule", topic, candidates, suggestions: [], ...(outcome.mode === "high" && candidates.length > 1 ? { moreLabel: t.highMore } : {}) };
}

export interface DetailResult {
  id: string;
  title: string;
  category: string;
  text: string;
  url?: string;
}

/** 某一項的詳細資訊：資料裡真實存在的內容（過長會截斷）。 */
export function detailFor(d: SearchDoc, lang: AssistantLang, max = 900): DetailResult {
  const parts =
    d.kind === "rule"
      ? [pickLang(d.answerZh ?? "", d.answerEn ?? "", lang)]
      : [pickLang(d.bodyZh, d.bodyEn, lang), pickLang(d.extraZh ?? "", d.extraEn ?? "", lang)];
  let text = parts.filter(Boolean).join("\n\n").trim();
  if (text.length > max) text = text.slice(0, max).replace(/[，、,\s]+$/, "") + "…";
  const r: DetailResult = { id: d.id, title: pickLang(d.titleZh, d.titleEn, lang), category: pickLang(d.categoryZh, d.categoryEn, lang), text };
  if (d.url) r.url = d.url;
  return r;
}
