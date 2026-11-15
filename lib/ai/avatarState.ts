/**
 * 威洛頭像（動作圖片）狀態。純邏輯、沒有 React，方便測試；畫面與 API 都依賴這裡。
 *
 *  idle        待機（原本威洛圖片）
 *  thinking    送出問題、等待回應中
 *  life_info   正在回答「生活資訊」類問題（依實際分類，不看字數）
 *  unresolved  確認無法回答（沒有任何規則命中／API 錯誤／逾時／空回覆）
 *
 * 優先順序：unresolved > life_info > thinking > idle
 */
import type { LifeTopic } from "./topic";
import type { PublicQuestionType } from "./questionTypes";

export type AvatarState = "idle" | "thinking" | "life_info" | "unresolved" | "custom";

/** 一次回覆的結果（API 回傳 → 前端 → 這裡）。 */
export type ReplyOutcome =
  | { kind: "answered"; topic: LifeTopic | null; type?: PublicQuestionType | null } // 有答案；topic 有值＝生活資訊；type＝後台設定的問題類型
  | { kind: "unresolved"; reason: "no_match" | "error" | "empty" | "timeout"; type?: PublicQuestionType | null };

export const AVATAR_STATE_LABEL: Record<AvatarState, string> = {
  idle: "待機",
  thinking: "思考中",
  life_info: "生活資訊回答中",
  unresolved: "暫時無法解決",
  custom: "自訂問題類型",
};

/** 回答／無法解決的動作維持多久後回到待機（毫秒）。 */
export const AVATAR_HOLD_MS = 4000;
/** 超過這個時間沒有回應視為逾時 → unresolved。 */
export const REPLY_TIMEOUT_MS = 15000;

export function resolveAvatarState(input: { pending: boolean; outcome: ReplyOutcome | null }): AvatarState {
  const { pending, outcome } = input;
  // 後台設定的問題類型（有圖片才算）：回答完成後的外觀；思考中（pending 且尚無結果）不會走到這裡
  if (outcome?.type?.imageUrl) return "custom";
  if (outcome?.kind === "unresolved") return "unresolved";
  if (outcome?.kind === "answered" && outcome.topic) return "life_info";
  if (pending) return "thinking";
  return "idle";
}

/** 依 API 回傳的資料決定結果；格式不對（沒有文字）一律當作 unresolved(empty)。 */
export function outcomeFromReply(data: { reply?: unknown; kind?: unknown; topic?: unknown; type?: unknown } | null | undefined): ReplyOutcome {
  if (!data || typeof data.reply !== "string" || !data.reply.trim()) return { kind: "unresolved", reason: "empty" };
  const type = publicTypeFrom(data.type);
  if (data.kind === "fallback") return { kind: "unresolved", reason: "no_match", type };
  const topic = typeof data.topic === "string" && data.topic ? (data.topic as LifeTopic) : null;
  return { kind: "answered", topic, type };
}

/** 請求失敗（網路錯誤、HTTP 錯誤、停用、逾時）一律是「無法解決」，逾時另外標記原因。 */
export function outcomeFromError(err: unknown): ReplyOutcome {
  const timeout = err instanceof Error && err.message === "assistant_timeout";
  return { kind: "unresolved", reason: timeout ? "timeout" : "error" };
}

/** API 回來的 type 欄位只接受長得像 PublicQuestionType 的物件。 */
export function publicTypeFrom(v: unknown): PublicQuestionType | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || typeof o.id !== "string") return null;
  const img = typeof o.imageUrl === "string" ? o.imageUrl : "";
  return { id: o.id, key: String(o.key ?? ""), labelZh: String(o.labelZh ?? ""), labelEn: String(o.labelEn ?? ""), imageUrl: img };
}
