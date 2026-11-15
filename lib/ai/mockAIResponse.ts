import { DEFAULT_ASSISTANT_RULES, DEFAULT_ASSISTANT_SETTINGS } from "./defaults";
import type { AssistantLang, AssistantRuleData } from "./types";

/** mockAIResponse 需要的資料：規則（來自資料庫）與兩個語言的預設回覆。 */
export interface MockAIConfig {
  rules: Pick<AssistantRuleData, "keywords" | "replyZh" | "replyEn" | "enabled" | "priority">[];
  fallbackZh: string;
  fallbackEn: string;
}

const DEFAULT_CONFIG: MockAIConfig = {
  rules: DEFAULT_ASSISTANT_RULES,
  fallbackZh: DEFAULT_ASSISTANT_SETTINGS.fallbackZh,
  fallbackEn: DEFAULT_ASSISTANT_SETTINGS.fallbackEn,
};

/** 把「換行或逗號（半形/全形/頓號）分隔」的字串拆成關鍵字陣列。 */
export function splitKeywords(raw: string): string[] {
  return raw
    .split(/[\n,，、;；]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * 單一關鍵字是否出現在使用者輸入中。
 * - 中文等非英文字母關鍵字：單純「包含」。
 * - 英文關鍵字：不分大小寫，且要從單字開頭開始比對（school 可命中 schools，
 *   但 hi 不會命中 this／high）；3 個字母以內的短字必須是完整單字。
 */
export function keywordMatches(input: string, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return false;
  const text = input.toLowerCase();
  if (/^[a-z0-9' ]+$/.test(kw)) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tail = kw.length <= 3 ? "(?![a-z0-9])" : "";
    return new RegExp(`(^|[^a-z0-9])${escaped}${tail}`).test(text);
  }
  return text.includes(kw);
}

export interface MockMatch {
  text: string;
  /** "rule" = 有規則命中；"fallback" = 沒有任何規則命中（威洛答不出來） */
  kind: "rule" | "fallback";
}

/** 比對規則並回報「是規則命中還是沒有命中」，頭像狀態（有答案／無法解決）靠這個區分。 */
export function matchMockResult(userMessage: string, language: AssistantLang, config: MockAIConfig = DEFAULT_CONFIG): MockMatch {
  const rules = [...config.rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  for (const rule of rules) {
    if (splitKeywords(rule.keywords).some((k) => keywordMatches(userMessage, k))) {
      const reply = language === "en" ? rule.replyEn : rule.replyZh;
      // 該語言的回覆留空時，退回另一種語言，避免回出空白訊息
      const text = reply.trim() || (language === "en" ? rule.replyZh : rule.replyEn).trim();
      if (text) return { text, kind: "rule" };
    }
  }
  return { text: language === "en" ? config.fallbackEn : config.fallbackZh, kind: "fallback" };
}

/** 同步版本：純關鍵字比對，依 priority 由小到大，第一個命中的規則勝出。 */
export function matchMockReply(userMessage: string, language: AssistantLang, config: MockAIConfig = DEFAULT_CONFIG): string {
  return matchMockResult(userMessage, language, config).text;
}

/**
 * 假 AI 回覆（關鍵字判斷，不是真的 AI，沒有任何外部呼叫）。
 * 簽名固定為 (使用者訊息, 語言) → Promise<字串>，未來換成真正的 API 時保持相同簽名即可。
 */
export async function mockAIResponse(
  userMessage: string,
  language: AssistantLang,
  config: MockAIConfig = DEFAULT_CONFIG
): Promise<string> {
  return matchMockReply(userMessage, language, config);
}
