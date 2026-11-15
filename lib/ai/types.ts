import type { ReplyOutcome } from "./avatarState";
import type { SearchCandidate, SectionLink } from "./search/respond";

/** AI 助理共用型別。UI、服務層、provider 都只依賴這裡，彼此不互相引用實作。 */

export type AssistantLang = "zh-TW" | "en";
export type AssistantCorner = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type AssistantButtonStyle = "round" | "square" | "pill";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** 搜尋到的候選資料（只有威洛的搜尋回覆才有） */
  candidates?: SearchCandidate[];
  /** 完全沒有相關資料時，引導使用者去的網站區域 */
  suggestions?: SectionLink[];
  /** 高度相關時，第一項之後的小標題 */
  moreLabel?: string | null;
  /** 這則回覆是在回答哪個問題；有值才會在下方顯示「提交問題」 */
  asked?: string;
}

/** 後台可調整的助理設定（對應 AssistantSetting 資料表，不含 id/updatedAt）。 */
export interface AssistantSettings {
  enabled: boolean;
  nameZh: string;
  nameEn: string;
  welcomeZh: string;
  welcomeEn: string;
  fallbackZh: string;
  fallbackEn: string;
  defaultLang: AssistantLang;
  allowLangSwitch: boolean;
  showName: boolean;
  showTyping: boolean;
  keepHistory: boolean;

  imageUrl: string;
  /** 動作圖片（後台上傳；空字串＝用內建預設，沒有內建預設就用待機圖） */
  thinkingImageUrl: string;
  unresolvedImageUrl: string;
  lifeInfoImageUrl: string;
  sizeDesktop: number;
  sizeMobile: number;
  position: AssistantCorner;
  edgeDistance: number;
  panelWidth: number;
  panelHeight: number;
  panelRadius: number;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  buttonStyle: AssistantButtonStyle;
  showShadow: boolean;
  allowDrag: boolean;
  showLangButton: boolean;
}

/** 一條關鍵字規則（對應 AssistantRule）。 */
export interface AssistantRuleData {
  id: string;
  keywords: string;
  replyZh: string;
  replyEn: string;
  enabled: boolean;
  priority: number;
}

/** 前台拿到的設定：設定 + 版本戳（用來讓舊的拖曳位置失效）。 */
export interface AssistantPublicConfig {
  settings: AssistantSettings;
  version: string;
}

/**
 * AI provider 介面。
 * 目前只有「呼叫自己網站 /api/assistant/reply（假 AI）」；未來接真正 API 時，
 * 新增一個實作這個介面的 provider，到 assistantService.ts 換掉即可，
 * 聊天 UI 與後台都不需要改。
 */
/** provider 的回覆：文字 + 頭像狀態需要的結果（有答案／生活資訊／無法解決）。 */
export interface AssistantReplyResult {
  text: string;
  outcome: ReplyOutcome;
  candidates?: SearchCandidate[];
  suggestions?: SectionLink[];
  moreLabel?: string | null;
}

export interface AIProvider {
  reply(userMessage: string, lang: AssistantLang, history: ChatMessage[]): Promise<AssistantReplyResult>;
}
