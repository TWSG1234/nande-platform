export type LangCode = "zh-TW" | "en";

/** Every piece of user-facing content is stored bilingually and picked at render time. */
export interface Localized {
  "zh-TW": string;
  en: string;
}

/** Produced by lib/announcementGenerator.ts, or sourced from an admin-authored Announcement row. */
export interface GeneratedAnnouncement {
  id: string;
  kind: "admin" | "holiday" | "drill" | "memorial" | "fallback";
  title: Localized;
  body: Localized;
  /** 公告內的文字連結（只有後台管理的公告會有；已解析成可直接使用的網址） */
  links?: { id: string; label: Localized; href: string; external: boolean; color: string }[];
}

/** An admin-authored announcement, read from the Announcement table (see /admin/announcements). */
export interface AdminAnnouncement {
  id: string;
  title: Localized;
  body: Localized;
  image?: string | null;
  links?: { id: string; label: Localized; href: string; external: boolean; color: string }[];
}

/** An IP character shown on the /ip-characters gallery page (see /admin/characters). */
export interface IpCharacter {
  id: string;
  name: string;
  image: string;
  intro: Localized;
  position: Localized;
  personality: Localized;
  quote: Localized;
  conceptTitle: Localized;
  backImage: string | null;
  backImageWidth: number | null;
  backImageHeight: number | null;
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
  dialogue: Localized | null;
  dialogueEnabled: boolean;
  homePosition: "characterA" | "characterB" | "characterC" | null;
  dialogueLines: { id: string; text: Localized }[];
}

/** 校園座標分類 id（後台可新增分類，所以是字串；內建兩個是 "culture"、"school-units"）。 */
export type CampusCategoryId = string;

export interface CampusSpot {
  id: string;
  name: Localized;
  category: CampusCategoryId;
  description: Localized;
  details?: Localized; // full write-up for the detail page (culture Q&A entries)
  hours?: Localized;
  image?: string | null; // 後台上傳的項目圖片（站內網址 /uploads/...）；沒設定就不顯示
  schoolTimes?: { school: string; time: string }[]; // 各校時間（升旗／午休），顯示在卡片介紹文字下方
  tips?: Localized;
  mainResponsibility?: Localized; // school-unit entries: what the office handles
  exchangeStudentMayEncounter?: Localized[]; // school-unit entries: situations that send you there
}

/**
 * `isHoliday` drives the holiday/memorial color distinction throughout the UI.
 * `isAnchor` + `groupLabel` mark the single representative date search for each
 * connected holiday block, used by the homepage announcement generator's
 * "3 days before" countdown (see lib/announcementGenerator.ts) — every other
 * date in a multi-day block (e.g. the 2nd/3rd day of Lunar New Year) omits
 * these so the countdown only fires once per occasion.
 */
export interface CalendarEvent {
  id: string;
  date: string; // ISO date, yyyy-mm-dd
  name: Localized; // shown directly in the calendar day cell
  isHoliday: boolean; // true = paid day off; false = observance/memorial only
  isMakeup?: boolean; // true if this date is a "補假" day-in-lieu, not the festival's actual date
  description: Localized; // short "節日介紹" blurb shown in the click-through info modal
  origin?: Localized; // "節日由來" — background/history, kept factual; folklore explicitly labeled as such
  taiwanCustoms?: Localized[]; // "台灣怎麼過？" — common customs, only included where well-attested
  source?: Localized; // "資料來源" citation shown at the bottom of the modal
  tag?: Localized; // special annotation, e.g. "災難紀念日．非放假日" for 9/21
  isAnchor?: boolean;
  groupLabel?: Localized;
  image?: string; // 節日小圖（站內網址 /uploads/...）；沒設定就不顯示
}

export interface LifeItem {
  id: string;
  title: Localized;
  detail: Localized; // short summary shown on the category card
  fullDetail: Localized; // complete paragraph(s) shown on the detail page
  tip?: Localized; // optional short practical tip shown on the detail page
  image?: string | null; // 後台上傳的項目圖片（站內網址 /uploads/...）；沒設定就不顯示
  officialLinks?: { url: string; label: Localized }[]; // optional "official source" buttons (e.g. TRA, YouBike)
}

export interface LifeCategory {
  id: string;
  name: Localized;
  icon: string;
  description: Localized;
  items: LifeItem[];
}

export type ChineseCategoryId =
  | "language-adaptation"
  | "campus-adaptation"
  | "social-adaptation"
  | "cultural-exchange";

/** Drives the reusable drink illustration — each piece is toggled independently. */
export interface DrinkConfig {
  liquid: "empty" | "milk" | "tea" | "bubbleTea";
  ice?: boolean;
  foam?: boolean;
  straw?: boolean;
}

export interface VocabularyItem {
  chinese: string;
  pinyin: string;
  english: string;
}

export interface DialogueLine {
  speaker: string; // e.g. "A", "B", "交換生", "同學", "老師", "店員", "老闆", "路人"
  chinese: string;
  pinyin: string;
  english: string;
}

export interface ChineseLevel {
  id: string; // e.g. "language-adaptation-1"
  categoryId: ChineseCategoryId;
  level: number; // 1-based position within the category
  title: Localized;
  drink: DrinkConfig;
  vocabulary: VocabularyItem[];
  sentences: DialogueLine[];
}

export interface ChineseCategory {
  id: ChineseCategoryId;
  nameZh: string;
  nameEn: string;
  description: Localized;
  icon: string; // lucide-react icon name
}

export interface SearchRecord {
  id: string;
  type: "campus" | "life";
  title: Localized;
  snippet: Localized;
  keywords: string; // pre-lowercased, both languages, for matching
  href: string;
}
