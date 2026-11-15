import { Localized } from "@/lib/types";

/**
 * Shown on the homepage announcement board only when nothing more important
 * is happening (no upcoming holiday within 3 days, not drill season, no
 * upcoming memorial day) — see lib/announcementGenerator.ts. These rotate
 * through the existing AnnouncementCarousel just like a real event would.
 */
export const fallbackAnnouncements: { id: string; title: Localized; body: Localized }[] = [
  {
    id: "fallback-chinese",
    title: { "zh-TW": "想更快適應台灣生活？", en: "Want to settle into Taiwan life faster?" },
    body: {
      "zh-TW": "可以到中文學習區練習日常用語，從打招呼到點餐，一關一關累積實用中文！",
      en: "Head to the Chinese Learning area to practice everyday phrases — from greetings to ordering food, one level at a time.",
    },
  },
  {
    id: "fallback-life",
    title: { "zh-TW": "生活小提醒", en: "Everyday tip" },
    body: {
      "zh-TW": "最近沒有連假，不妨趁空檔逛逛生活座標，了解台灣街頭巷尾的小文化！",
      en: "No long weekend on the horizon — a good time to browse the Life Guide and pick up a few everyday Taiwan customs.",
    },
  },
  {
    id: "fallback-campus",
    title: { "zh-TW": "校園生活小知識", en: "Campus life, explained" },
    body: {
      "zh-TW": "還在好奇台灣校園的升旗、打掃、制服是怎麼回事嗎？校園座標都幫你整理好了。",
      en: "Curious about flag-raising, school cleaning duty, or uniforms? The Campus Guide breaks it all down.",
    },
  },
  {
    id: "fallback-calendar",
    title: { "zh-TW": "先規劃你的下一個連假", en: "Plan ahead for your next long weekend" },
    body: {
      "zh-TW": "打開台灣行事曆，提前看看接下來的國定假日，安排你的旅遊或休息時間。",
      en: "Check the Taiwan Calendar to see upcoming public holidays and start planning your next trip or rest day.",
    },
  },
];
