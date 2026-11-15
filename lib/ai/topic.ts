/**
 * 「這是不是台灣生活資訊問題」的分類（依問題內容，不是依字數）。
 * 類別：交通、飲食、購物與日常、校園生活、台灣文化／節日／習慣。
 * 純函式、沒有外部呼叫；之後換成真正 AI 時，改由 AI 回傳 category 即可，狀態邏輯不用改。
 */
import { keywordMatches } from "./mockAIResponse";

export type LifeTopic = "transport" | "food" | "daily" | "campus" | "culture";

const TOPICS: Record<LifeTopic, string[]> = {
  transport: ["交通", "搭車", "公車", "捷運", "高鐵", "火車", "台鐵", "計程車", "機車", "腳踏車", "悠遊卡", "一卡通", "轉乘", "transport", "bus", "mrt", "metro", "train", "taxi", "scooter", "bike", "easycard", "ticket"],
  food: ["美食", "吃", "餐廳", "小吃", "夜市", "飲料", "早餐", "素食", "food", "eat", "restaurant", "night market", "snack", "breakfast", "vegetarian", "drink"],
  daily: ["生活", "購物", "超商", "便利商店", "超市", "租屋", "宿舍", "銀行", "手機", "電話卡", "醫院", "看病", "垃圾", "daily", "shopping", "convenience store", "supermarket", "rent", "dorm", "bank", "sim card", "hospital", "garbage"],
  campus: ["校園", "學校", "選課", "社團", "圖書館", "學生證", "註冊", "campus", "school", "class", "club", "library", "student id", "register"],
  culture: ["文化", "節日", "放假", "行事曆", "習俗", "禮儀", "廟", "拜拜", "春節", "中秋", "端午", "culture", "festival", "holiday", "calendar", "custom", "etiquette", "temple"],
};

/** 回傳命中的生活資訊類別；不屬於生活資訊（例如打招呼、閒聊）回傳 null。 */
export function classifyLifeTopic(question: string): LifeTopic | null {
  for (const topic of Object.keys(TOPICS) as LifeTopic[]) {
    if (TOPICS[topic].some((k) => keywordMatches(question, k))) return topic;
  }
  return null;
}
