import type { AssistantRuleData, AssistantSettings } from "./types";

/**
 * 預設值：資料庫沒有資料列（或資料表還沒建立）時的 fallback，
 * 也是後台「恢復預設值」與第一次進後台時寫入資料庫的初始內容。
 * 前台元件不會直接引用這個檔案（只有伺服器端與後台編輯器會用）。
 */
export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  enabled: true,
  nameZh: "威洛",
  nameEn: "Willow",
  welcomeZh: "你好！我是威洛，很高興認識你！有什麼關於台灣校園或生活的問題，都可以問問我喔！",
  welcomeEn:
    "Hi! I’m Willow. It’s nice to meet you! Feel free to ask me anything about school life or daily life in Taiwan!",
  fallbackZh: "嗯……這個問題我目前還在學習中！你可以換個方式問問我，或到網站上的相關區域看看喔！",
  fallbackEn:
    "Hmm… I’m still learning about that one! Try asking in a different way, or look around the related sections of the website!",
  defaultLang: "zh-TW",
  allowLangSwitch: true,
  showName: true,
  showTyping: true,
  keepHistory: true,

  imageUrl: "",
  thinkingImageUrl: "",
  unresolvedImageUrl: "",
  lifeInfoImageUrl: "",
  sizeDesktop: 140,
  sizeMobile: 88,
  position: "bottom-right",
  edgeDistance: 24,
  panelWidth: 360,
  panelHeight: 480,
  panelRadius: 16,
  primaryColor: "#84bed7",
  secondaryColor: "#2a6ea2",
  bgColor: "#ffffff",
  textColor: "#1f2937",
  buttonStyle: "round",
  showShadow: true,
  allowDrag: true,
  showLangButton: true,
};

/** 初始關鍵字規則（priority 越小越先比對；打招呼放最後）。 */
export const DEFAULT_ASSISTANT_RULES: Omit<AssistantRuleData, "id">[] = [
  {
    keywords: "校園, 學校, school, campus",
    replyZh:
      "如果你想了解台灣的校園生活，可以到『校園座標』看看喔！裡面整理了校園文化、校內單位以及一些實用資訊。",
    replyEn:
      "You can explore Campus Guide to learn about school culture, campus offices, and useful information for students in Taiwan!",
    enabled: true,
    priority: 10,
  },
  {
    keywords: "生活, 交通, 美食, life, transport, food",
    replyZh: "台灣的生活有很多有趣的小細節！你可以到『生活座標』看看交通、美食、生活資訊以及南部特色景點。",
    replyEn:
      "Discover Life Guide for information about transportation, food, daily life, and interesting places in southern Taiwan!",
    enabled: true,
    priority: 20,
  },
  {
    keywords: "中文, 學中文, chinese",
    replyZh: "如果你想學中文，可以到『中文學習』，裡面有生活與校園情境的中文學習內容喔！",
    replyEn:
      "Visit Chinese Learning to explore useful Chinese words and phrases for everyday situations and campus life!",
    enabled: true,
    priority: 30,
  },
  {
    keywords: "行事曆, 放假, 節日, calendar, holiday",
    replyZh: "可以到『台灣行事曆』查看台灣的節日與放假資訊喔！",
    replyEn: "Check out the Taiwan Calendar to see festivals and public holidays in Taiwan!",
    enabled: true,
    priority: 40,
  },
  {
    keywords: "你好, 哈囉, hello, hi",
    replyZh: "你好！我是威洛，很高興認識你！如果你剛來台灣，有任何校園或生活上的問題，都可以問我喔！",
    replyEn:
      "Hi! I’m Willow, nice to meet you! If you’ve just arrived in Taiwan, feel free to ask me anything about school or daily life!",
    enabled: true,
    priority: 90,
  },
];
