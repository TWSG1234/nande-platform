import { outcomeFromReply, publicTypeFrom } from "./avatarState";
import type { PublicQuestionType } from "./questionTypes";
import type { SearchCandidate, SectionLink } from "./search/respond";
import type { AIProvider, AssistantLang, AssistantReplyResult, ChatMessage } from "./types";

/**
 * 助理服務層：聊天介面唯一的入口。
 * 目前的 provider 呼叫自己網站的 /api/assistant/reply，背後是關鍵字假 AI（mockAIResponse，
 * 規則來自資料庫）。未來接真正 AI：新增一個實作 AIProvider 的物件（或直接修改該 API route），
 * 並把 activeProvider 換成它，聊天 UI 與後台都不用改。
 */
export class AssistantDisabledError extends Error {
  constructor() {
    super("assistant_disabled");
  }
}

const siteProvider: AIProvider = {
  async reply(userMessage, lang) {
    const res = await fetch("/api/assistant/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, lang }),
    });
    if (res.status === 403) throw new AssistantDisabledError();
    if (!res.ok) throw new Error(`assistant_http_${res.status}`);
    const data = (await res.json()) as {
      reply?: string;
      kind?: string;
      topic?: string;
      type?: unknown;
      candidates?: SearchCandidate[];
      suggestions?: SectionLink[];
      moreLabel?: string | null;
    };
    if (!data.reply) throw new Error("assistant_empty_reply");
    return {
      text: data.reply,
      outcome: outcomeFromReply(data),
      candidates: Array.isArray(data.candidates) ? data.candidates : [],
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      moreLabel: data.moreLabel ?? null,
    };
  },
};

const activeProvider: AIProvider = siteProvider;

export async function askAssistantDetailed(
  userMessage: string,
  lang: AssistantLang,
  history: ChatMessage[] = []
): Promise<AssistantReplyResult> {
  return activeProvider.reply(userMessage, lang, history);
}

/** 只要文字的簡易版。 */
export async function askAssistant(userMessage: string, lang: AssistantLang, history: ChatMessage[] = []): Promise<string> {
  return (await askAssistantDetailed(userMessage, lang, history)).text;
}

/** 使用者在候選清單選了某一項：向伺服器取該筆（已發布）資料的詳細內容。找不到（例如剛被停用）回傳 null。 */
export async function fetchCandidateDetail(
  id: string,
  lang: AssistantLang
): Promise<{ id: string; title: string; category: string; text: string; url?: string; type?: PublicQuestionType | null } | null> {
  const res = await fetch("/api/assistant/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lang }),
  });
  if (res.status === 404) return null;
  if (res.status === 403) throw new AssistantDisabledError();
  if (!res.ok) throw new Error(`assistant_http_${res.status}`);
  const d = await res.json();
  return { ...d, type: publicTypeFrom(d?.type) };
}

export interface SubmitQuestionPayload {
  clientKey: string;
  question: string;
  category: string;
  note: string;
  lang: AssistantLang;
  context?: { question: string; candidates: { title: string; category: string }[] };
}

/** 提交問題：伺服器確認成功保存才回傳 ok:true。 */
export async function submitQuestion(payload: SubmitQuestionPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/assistant/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: typeof data.error === "string" ? data.error : `http_${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: data.ok === true };
  } catch {
    return { ok: false, error: "network" };
  }
}
