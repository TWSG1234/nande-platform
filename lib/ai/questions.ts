/** 問題求助：輸入驗證／清理（純函式，前後端與測試共用）與簡易速率限制。 */

export const QUESTION_CATEGORIES = ["life", "campus", "transport", "chinese", "culture", "other"] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];
export const QUESTION_CATEGORY_LABEL: Record<QuestionCategory, string> = {
  life: "生活",
  campus: "校園",
  transport: "交通",
  chinese: "中文學習",
  culture: "台灣文化",
  other: "其他",
};
export const QUESTION_STATUSES = ["pending", "organizing", "knowledge_created", "rejected"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  pending: "待處理",
  organizing: "整理中",
  knowledge_created: "已建立知識",
  rejected: "暫不採用",
};

export const LIMITS = { question: 300, note: 1000, contextQuestion: 300, candidateTitle: 100, candidateCategory: 60, candidates: 5, standard: 300, answer: 3000, synonyms: 1000, adminNote: 1000, url: 500 };

/** 去掉控制字元、統一換行、修剪並限制長度。顯示時由 React／純文字呈現，不會被當成 HTML。 */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

export interface SubmittedQuestion {
  clientKey: string;
  question: string;
  category: QuestionCategory | "";
  note: string;
  lang: "zh-TW" | "en";
  contextQuestion: string;
  contextCandidates: { title: string; category: string }[];
}

export type ValidateResult = { ok: true; value: SubmittedQuestion } | { ok: false; error: string };

export function validateSubmission(input: unknown): ValidateResult {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const clientKey = typeof b.clientKey === "string" ? b.clientKey.trim() : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(clientKey)) return { ok: false, error: "bad_client_key" };
  const question = cleanText(b.question, LIMITS.question);
  if (question.length < 2) return { ok: false, error: "question_required" };
  const category = typeof b.category === "string" && (QUESTION_CATEGORIES as readonly string[]).includes(b.category) ? (b.category as QuestionCategory) : "";
  const ctx = (b.context && typeof b.context === "object" ? b.context : {}) as Record<string, unknown>;
  const rawCands = Array.isArray(ctx.candidates) ? ctx.candidates.slice(0, LIMITS.candidates) : [];
  const contextCandidates = rawCands
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : {}))
    .map((c) => ({ title: cleanText(c.title, LIMITS.candidateTitle), category: cleanText(c.category, LIMITS.candidateCategory) }))
    .filter((c) => c.title);
  return {
    ok: true,
    value: {
      clientKey,
      question,
      category,
      note: cleanText(b.note, LIMITS.note),
      lang: b.lang === "en" ? "en" : "zh-TW",
      contextQuestion: cleanText(ctx.question, LIMITS.contextQuestion),
      contextCandidates,
    },
  };
}

/** 站內路徑（/life/bus）或 https 連結；其他（javascript:、//、http:）一律不接受。空字串＝沒有連結。 */
export function cleanSourceUrl(v: unknown): { ok: true; value: string } | { ok: false } {
  const s = cleanText(v, LIMITS.url);
  if (!s) return { ok: true, value: "" };
  if (s.startsWith("//") || /\s/.test(s)) return { ok: false };
  if (/^\/[A-Za-z0-9\-._~/%?=&#]*$/.test(s) || /^https:\/\/[^\s]+$/.test(s)) return { ok: true, value: s };
  return { ok: false };
}

/** 簡易速率限制（單一伺服器行程內；擋同一個來源短時間大量送出）。 */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    return true;
  };
}
