import type { AssistantLang } from "./types";

/** 助理介面固定文字（標題名稱、歡迎訊息、預設回覆由後台設定，不在這裡）。 */
interface Strings {
  titleSuffix: string;
  openLabel: string;
  close: string;
  placeholder: string;
  send: string;
  error: string;
  disabled: string;
  langLabel: string;
  chinese: string;
  english: string;
  findingHelp: string;
  openPage: string;
  seeDetail: string;
  loadingDetail: string;
  detailGone: string;
  relevance: string;
  levelHigh: string;
  levelMid: string;
  levelLow: string;
  expanded: string;
  askNotFound: string;
  askSubmit: string;
  formTitle: string;
  fQuestion: string;
  fCategory: string;
  fNote: string;
  fContext: string;
  fNoCategory: string;
  fSend: string;
  fSending: string;
  fCancel: string;
  fSuccess: string;
  fFail: string;
  fRequired: string;
  fPrivacy: string;
  categories: Record<"life" | "campus" | "transport" | "chinese" | "culture" | "other", string>;
}

const STRINGS: Record<AssistantLang, Strings> = {
  "zh-TW": {
    titleSuffix: "AI 助理",
    openLabel: "開啟助理",
    close: "關閉",
    placeholder: "輸入你想問的問題……",
    send: "發送",
    error: "哎呀，我剛剛走神了，可以再問一次嗎？",
    disabled: "小助理目前暫停服務。",
    langLabel: "語言",
    chinese: "中文",
    english: "English",
    findingHelp: "正在幫你找相關資訊……",
    openPage: "前往查看",
    seeDetail: "看詳細",
    loadingDetail: "正在讀取詳細資訊……",
    detailGone: "這項資料目前找不到了，可能已經更新或下架。",
    relevance: "相關程度",
    levelHigh: "高",
    levelMid: "中",
    levelLow: "低",
    expanded: "同分類延伸",
    askNotFound: "還沒找到想要的答案嗎？",
    askSubmit: "提交問題",
    formTitle: "把問題告訴我們",
    fQuestion: "問題內容（必填）",
    fCategory: "問題分類（選填）",
    fNote: "補充說明（選填）",
    fContext: "附上這次的提問與威洛找到的項目，幫助管理員了解情況（不會附上其他聊天紀錄）",
    fNoCategory: "不選擇",
    fSend: "送出問題",
    fSending: "送出中……",
    fCancel: "取消",
    fSuccess: "收到你的問題了！謝謝你幫助我們讓威洛變得更好。",
    fFail: "送出失敗，你填的內容還在，請稍後再試一次。",
    fRequired: "請先填寫問題內容。",
    fPrivacy: "請不要填寫姓名、電話等個人資料。管理員會人工整理後才會加入威洛的答案，不是即時客服。",
    categories: { life: "生活", campus: "校園", transport: "交通", chinese: "中文學習", culture: "台灣文化", other: "其他" },
  },
  en: {
    titleSuffix: "AI Assistant",
    openLabel: "Open assistant",
    close: "Close",
    placeholder: "Type your question…",
    send: "Send",
    error: "Oops, I got distracted for a moment. Could you ask again?",
    disabled: "The assistant is currently unavailable.",
    langLabel: "Language",
    chinese: "中文",
    english: "English",
    findingHelp: "Looking for related information…",
    openPage: "Open page",
    seeDetail: "Details",
    loadingDetail: "Loading details…",
    detailGone: "This item can't be found anymore. It may have been updated or removed.",
    relevance: "Relevance",
    levelHigh: "High",
    levelMid: "Medium",
    levelLow: "Low",
    expanded: "Related in same section",
    askNotFound: "Didn't find what you wanted?",
    askSubmit: "Submit a question",
    formTitle: "Tell us your question",
    fQuestion: "Your question (required)",
    fCategory: "Category (optional)",
    fNote: "Extra details (optional)",
    fContext: "Include this question and the items Willow found to help the admins (no other chat history is sent)",
    fNoCategory: "None",
    fSend: "Send question",
    fSending: "Sending…",
    fCancel: "Cancel",
    fSuccess: "We got your question! Thank you for helping make Willow better.",
    fFail: "Sending failed. Your text is still here — please try again in a moment.",
    fRequired: "Please enter your question first.",
    fPrivacy: "Please don't include your name, phone number, or other personal info. Admins review questions by hand before adding answers — this is not live support.",
    categories: { life: "Life", campus: "Campus", transport: "Transportation", chinese: "Chinese Learning", culture: "Taiwan Culture", other: "Other" },
  },
};

export type AssistantStrings = Strings;

export function assistantStrings(lang: AssistantLang): AssistantStrings {
  return STRINGS[lang] ?? STRINGS["zh-TW"];
}

/** 標題：顯示角色名稱時「威洛 AI 助理」／「Willow AI Assistant」，否則只顯示「AI 助理」。 */
export function assistantTitle(lang: AssistantLang, name: string, showName: boolean): string {
  const suffix = assistantStrings(lang).titleSuffix;
  return showName && name ? `${name} ${suffix}` : suffix;
}

/** 「威洛正在思考……」／「Willow is thinking…」；不顯示名稱時退回通用說法。 */
export function thinkingText(lang: AssistantLang, name: string, showName: boolean): string {
  if (lang === "en") return showName && name ? `${name} is thinking…` : "Thinking…";
  return showName && name ? `${name}正在思考……` : "正在思考……";
}
