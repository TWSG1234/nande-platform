import { CALENDAR_BASE_SELECT, isMissingImageColumn } from "@/lib/calendarDb";
import { withHolidayIcons } from "@/lib/holidayIcons";
import { prisma } from "@/lib/prisma";
import { stageTitleFrom } from "@/lib/chinese/stageName";
import { parseLinkSetRow, toLinkViews } from "@/lib/announcementLinks";
import { resolveCategories, toFrontCategoryId, type CategoryInfo } from "@/lib/campusCategories";
import { sanitizeDecor, type DecorImage, type DecorScope } from "@/lib/infoBoxDecor";
import { fromJsonField } from "@/lib/jsonFields";
import { cache } from "react";
import {
  CampusSpot,
  LifeCategory,
  ChineseCategory,
  ChineseLevel,
  CalendarEvent,
  IpCharacter,
  AdminAnnouncement,
  Localized,
  CampusCategoryId,
  ChineseCategoryId,
  DrinkConfig,
  VocabularyItem,
  DialogueLine,
} from "@/lib/types";

import { campusSpots as mockCampusSpots } from "@/lib/data/mockCampus";
import { lifeCategories as mockLifeCategories } from "@/lib/data/mockLife";
import { chineseCategories as mockChineseCategories, chineseLevels as mockChineseLevels } from "@/lib/data/chineseLearning";
import { calendarEvents as mockCalendarEvents } from "@/lib/data/mockCalendar";

/**
 * 這支檔案是「公開網站頁面」讀取資料的唯一入口，只能在 Server Component 裡
 * import（會用到 lib/prisma.ts，不能進到瀏覽器端的 bundle）。
 *
 * 每個函式的邏輯都一樣：先查資料庫（只拿 isPublished 的資料），查得到就用
 * 資料庫的內容；查詢過程出錯（例如資料庫還沒建好）或資料庫目前完全沒有資料
 * （例如還沒跑過 npm run db:seed）就退回使用 lib/data/*.ts 的 mock 資料，
 * 讓網站在任何情況下都不會直接掛掉、開天窗。
 */

function localizedOrUndefined(zh: string | null | undefined, en: string | null | undefined): Localized | undefined {
  if (!zh) return undefined;
  return { "zh-TW": zh, en: en || zh };
}

// ── 校園座標 ────────────────────────────────────────────────────────────

/** 校園座標分類（後台管理；資料表不存在或是空的就用預設兩個）。回傳前台 id（school_units → school-units）。 */
export async function getCampusCategoryInfos(): Promise<CategoryInfo[]> {
  try {
    const rows = await (prisma as any).campusCategory.findMany({ orderBy: [{ order: "asc" }] });
    return resolveCategories(rows);
  } catch {
    return resolveCategories([]);
  }
}

export async function getCampusCategories(): Promise<{ id: string; name: Localized; description?: Localized }[]> {
  const spotsAll = await getCampusSpotsRaw();
  const infos = resolveCategories(await getCampusCategoryInfos(), spotsAll.map((s) => s.categoryDb));
  return infos
    .filter((c) => c.isPublished)
    .map((c) => ({ id: toFrontCategoryId(c.id), name: { "zh-TW": c.nameZh, en: c.nameEn || c.nameZh }, ...(c.descriptionZh ? { description: { "zh-TW": c.descriptionZh, en: c.descriptionEn || c.descriptionZh } } : {}) }));
}

type CampusSpotWithDb = CampusSpot & { categoryDb: string };
async function getCampusSpotsRaw(): Promise<CampusSpotWithDb[]> {
  try {
    const rows = await prisma.campusSpot.findMany({
      where: { isPublished: true },
      orderBy: [{ order: "asc" }],
    });
    if (rows.length === 0) return mockCampusSpots.map((s) => ({ ...s, categoryDb: s.category === "school-units" ? "school_units" : s.category }));

    return rows.map((r) => ({
      id: r.id,
      categoryDb: r.category,
      category: toFrontCategoryId(r.category) as CampusCategoryId,
      name: { "zh-TW": r.nameZh, en: r.nameEn },
      description: { "zh-TW": r.descriptionZh, en: r.descriptionEn },
      details: localizedOrUndefined(r.detailsZh, r.detailsEn),
      hours: localizedOrUndefined(r.hoursZh, r.hoursEn),
      image: r.image,
      schoolTimes: fromJsonField<{ school: string; time: string }[]>(r.schoolTimes, []),
      tips: localizedOrUndefined(r.tipsZh, r.tipsEn),
      mainResponsibility: localizedOrUndefined(r.mainResponsibilityZh, r.mainResponsibilityEn),
      exchangeStudentMayEncounter: fromJsonField<Localized[] | undefined>(r.exchangeStudentMayEncounter, undefined),
    }));
  } catch (err) {
    console.error("[serverData] getCampusSpots fell back to mock data:", err);
    return mockCampusSpots.map((s) => ({ ...s, categoryDb: s.category === "school-units" ? "school_units" : s.category }));
  }
}

/** 前台用：只含「已發布項目」，而且所屬分類若被隱藏，項目也跟著不顯示。 */
export async function getCampusSpots(): Promise<CampusSpot[]> {
  const raw = await getCampusSpotsRaw();
  const infos = resolveCategories(await getCampusCategoryInfos(), raw.map((s) => s.categoryDb));
  const hidden = new Set(infos.filter((c) => !c.isPublished).map((c) => c.id));
  const rank = new Map(infos.map((c, i) => [c.id, i]));
  return raw
    .filter((s) => !hidden.has(s.categoryDb))
    .sort((a, b) => (rank.get(a.categoryDb)! - rank.get(b.categoryDb)!))
    .map(({ categoryDb: _c, ...spot }) => spot);
}

/** 資訊框裝飾圖片：boxId → 圖片清單。資料表不存在（尚未 db:push）或讀取失敗就回傳空物件，頁面照常顯示。 */
export async function getInfoBoxImages(scope: DecorScope): Promise<Record<string, DecorImage[]>> {
  try {
    const rows = await (prisma as any).infoBoxImage.findMany({ where: { scope }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    const out: Record<string, DecorImage[]> = {};
    rows.forEach((r: any, i: number) => {
      const d = sanitizeDecor(r, i);
      if (d) (out[r.boxId] ??= []).push({ ...d, id: r.id });
    });
    return out;
  } catch {
    return {};
  }
}

// ── 生活座標 ────────────────────────────────────────────────────────────

export async function getLifeCategories(): Promise<LifeCategory[]> {
  try {
    const categories = await prisma.lifeCategory.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
      include: { items: { where: { isPublished: true }, orderBy: { order: "asc" } } },
    });
    if (categories.length === 0) return mockLifeCategories;

    return categories.map((c) => ({
      id: c.id,
      name: { "zh-TW": c.nameZh, en: c.nameEn },
      icon: c.icon,
      description: { "zh-TW": c.descriptionZh, en: c.descriptionEn },
      items: c.items.map((item) => ({
        id: item.id,
        title: { "zh-TW": item.titleZh, en: item.titleEn },
        detail: { "zh-TW": item.detailZh, en: item.detailEn },
        fullDetail: { "zh-TW": item.fullDetailZh, en: item.fullDetailEn },
        tip: localizedOrUndefined(item.tipZh, item.tipEn),
        image: item.image,
        officialLinks: fromJsonField<{ url: string; label: Localized }[] | undefined>(item.officialLinks, undefined),
      })),
    }));
  } catch (err) {
    console.error("[serverData] getLifeCategories fell back to mock data:", err);
    return mockLifeCategories;
  }
}

// ── 中文學習 ────────────────────────────────────────────────────────────

export async function getChineseData(): Promise<{ categories: ChineseCategory[]; levels: ChineseLevel[] }> {
  try {
    const categoryRows = await prisma.chineseCategory.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
    });
    const levelRows = await prisma.chineseLevel.findMany({
      where: { isPublished: true },
      orderBy: [{ categoryId: "asc" }, { level: "asc" }],
    });
    if (categoryRows.length === 0) {
      return { categories: mockChineseCategories, levels: mockChineseLevels };
    }

    const categories: ChineseCategory[] = categoryRows.map((c) => ({
      id: c.id as ChineseCategoryId,
      nameZh: c.nameZh,
      nameEn: c.nameEn,
      description: { "zh-TW": c.descriptionZh, en: c.descriptionEn },
      icon: c.icon,
    }));

    const levels: ChineseLevel[] = levelRows.map((l) => ({
      id: l.id,
      categoryId: l.categoryId as ChineseCategoryId,
      level: l.level,
      title: { "zh-TW": l.titleZh, en: l.titleEn },
      drink: fromJsonField<DrinkConfig>(l.drink, { liquid: "empty" }),
      vocabulary: fromJsonField<VocabularyItem[]>(l.vocabulary, []),
      sentences: fromJsonField<DialogueLine[]>(l.sentences, []),
    }));

    return { categories, levels };
  } catch (err) {
    console.error("[serverData] getChineseData fell back to mock data:", err);
    return { categories: mockChineseCategories, levels: mockChineseLevels };
  }
}

// ── 中文學習 2.0（生活／校園 分區 + 自由編排的關卡頁面）───────────────────

export type ChineseStageSummary = {
  id: string;
  track: "life" | "campus";
  levelNumber: number;
  title: Localized | null; // 沒有自訂標題時是 null，畫面上顯示「第 N 關」
};

export type ChineseComicImage = { url: string; width: number; height: number; caption: Localized | null };

export type ChineseQuestionData = {
  id: string;
  questionType: "fill_blank" | "multiple_choice" | "matching" | "true_false";
  prompt: Localized;
  answerData: string;
  hint: Localized | null;
  explanation: Localized | null;
};

export type ChinesePageData = {
  id: string;
  type: "comic" | "vocabulary" | "fill_blank" | "multiple_choice" | "matching" | "true_false";
  title: Localized | null;
  comicImages: ChineseComicImage[];
  comicImagesEn: ChineseComicImage[];
  allowFlip: boolean;
  words: { id: string; hanzi: string; pinyin: string; english: string }[];
  questions: ChineseQuestionData[];
};

export type ChineseStageDetail = ChineseStageSummary & { pages: ChinesePageData[]; nextStage: ChineseStageSummary | null };

export async function getChineseStages(track: "life" | "campus"): Promise<ChineseStageSummary[]> {
  try {
    const rows = await prisma.chineseStage.findMany({
      where: { track, isPublished: true },
      orderBy: [{ order: "asc" }, { levelNumber: "asc" }],
    });
    return rows.map((s) => ({
      id: s.id,
      track: s.track as "life" | "campus",
      levelNumber: s.levelNumber,
      title: stageTitleFrom(s.titleZh, s.titleEn),
    }));
  } catch (err) {
    console.error("[serverData] getChineseStages returned empty (DB unreachable):", err);
    return [];
  }
}

export async function getChineseStageDetail(stageId: string): Promise<ChineseStageDetail | null> {
  try {
    const stage = await prisma.chineseStage.findUnique({
      where: { id: stageId },
      include: {
        pages: {
          where: { isPublished: true },
          orderBy: { order: "asc" },
          include: {
            words: { orderBy: { order: "asc" } },
            questions: { where: { isPublished: true }, orderBy: { order: "asc" } },
          },
        },
      },
    });
    if (!stage || !stage.isPublished) return null;

    // 下一關＝同一個分區、已發布、依「排序→關卡編號」排在這一關後面的那一關（跟關卡列表同一套順序）。最後一關是 null。
    const siblings = await getChineseStages(stage.track as "life" | "campus");
    const at = siblings.findIndex((x) => x.id === stage.id);
    const nextStage = at >= 0 ? (siblings[at + 1] ?? null) : null;

    return {
      id: stage.id,
      track: stage.track as "life" | "campus",
      levelNumber: stage.levelNumber,
      title: stageTitleFrom(stage.titleZh, stage.titleEn),
      nextStage,
      pages: stage.pages.map((p) => ({
        id: p.id,
        type: p.type as ChinesePageData["type"],
        title: p.titleZh ? { "zh-TW": p.titleZh, en: p.titleEn || p.titleZh } : null,
        comicImages: fromJsonField<
          { url: string; width: number; height: number; captionZh?: string; captionEn?: string }[]
        >(p.comicImages, []).map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
          caption: img.captionZh ? { "zh-TW": img.captionZh, en: img.captionEn || img.captionZh } : null,
        })),
        comicImagesEn: fromJsonField<
          { url: string; width: number; height: number; captionZh?: string; captionEn?: string }[]
        >(p.comicImagesEn, []).map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
          caption: img.captionZh ? { "zh-TW": img.captionZh, en: img.captionEn || img.captionZh } : null,
        })),
        allowFlip: p.allowFlip,
        words: p.words.map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, english: w.english })),
        questions: p.questions.map((q) => ({
          id: q.id,
          questionType: q.questionType as ChineseQuestionData["questionType"],
          // 題目不做「英文空白就複製中文」的回退：後台設定什麼就顯示什麼（前台 promptRows 決定顯示哪幾列）
          prompt: { "zh-TW": q.promptZh, en: q.promptEn },
          answerData: q.answerData,
          hint: q.hintZh ? { "zh-TW": q.hintZh, en: q.hintEn || q.hintZh } : null,
          explanation: q.explanationZh ? { "zh-TW": q.explanationZh, en: q.explanationEn || q.explanationZh } : null,
        })),
      })),
    };
  } catch (err) {
    console.error("[serverData] getChineseStageDetail returned null (DB unreachable):", err);
    return null;
  }
}

// ── 台灣行事曆 ──────────────────────────────────────────────────────────

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  return withHolidayIcons(await loadCalendarEvents());
}

async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    type Row = Awaited<ReturnType<typeof prisma.calendarEvent.findMany>>[number];
    let rows: (Omit<Row, "imageUrl"> & { imageUrl?: string | null })[];
    try {
      rows = await prisma.calendarEvent.findMany({ where: { isPublished: true }, orderBy: { date: "asc" } });
    } catch (err) {
      // 資料庫還沒執行 db:push 新增 imageUrl 欄位：改用不含該欄位的查詢，行事曆照常顯示（只是沒有小圖）。
      if (!isMissingImageColumn(err)) throw err;
      console.warn("[serverData] CalendarEvent.imageUrl 欄位尚未建立，暫時不顯示節日小圖（請執行 npm run db:push）。");
      rows = await prisma.calendarEvent.findMany({
        where: { isPublished: true },
        orderBy: { date: "asc" },
        select: CALENDAR_BASE_SELECT,
      });
    }
    if (rows.length === 0) return mockCalendarEvents;

    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      name: { "zh-TW": r.nameZh, en: r.nameEn },
      isHoliday: r.isHoliday,
      isMakeup: r.isMakeup,
      description: { "zh-TW": r.descriptionZh, en: r.descriptionEn },
      origin: localizedOrUndefined(r.originZh, r.originEn),
      taiwanCustoms: fromJsonField<Localized[] | undefined>(r.taiwanCustoms, undefined),
      source: localizedOrUndefined(r.sourceZh, r.sourceEn),
      tag: localizedOrUndefined(r.tagZh, r.tagEn),
      isAnchor: r.isAnchor,
      groupLabel: localizedOrUndefined(r.groupLabelZh, r.groupLabelEn),
      ...(r.imageUrl ? { image: r.imageUrl } : {}),
    }));
  } catch (err) {
    console.error("[serverData] getCalendarEvents fell back to mock data:", err);
    return mockCalendarEvents;
  }
}

// ── IP 角色圖鑑（/ip-characters；首頁 Hero 的 3 隻角色維持原本寫死方式）──────

export async function getIpCharacters(): Promise<IpCharacter[]> {
  try {
    const rows = await prisma.ipCharacter.findMany({
      where: { isVisible: true },
      orderBy: { order: "asc" },
      include: { dialogueLines: { where: { isEnabled: true }, orderBy: { order: "asc" } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      intro: { "zh-TW": c.introZh, en: c.introEn || c.introZh },
      position: { "zh-TW": c.positionZh, en: c.positionEn || c.positionZh },
      personality: { "zh-TW": c.personalityZh, en: c.personalityEn || c.personalityZh },
      quote: { "zh-TW": c.quoteZh, en: c.quoteEn || c.quoteZh },
      conceptTitle: { "zh-TW": c.conceptTitleZh, en: c.conceptTitleEn || c.conceptTitleZh },
      backImage: c.backImage,
      backImageWidth: c.backImageWidth,
      backImageHeight: c.backImageHeight,
      bgColor: c.bgColor,
      borderColor: c.borderColor,
      textColor: c.textColor,
      accentColor: c.accentColor,
      dialogue: c.dialogueZh ? { "zh-TW": c.dialogueZh, en: c.dialogueEn || c.dialogueZh } : null,
      dialogueEnabled: c.dialogueEnabled,
      homePosition: c.homePosition as "characterA" | "characterB" | "characterC" | null,
      dialogueLines: c.dialogueLines.map((d) => ({ id: d.id, text: { "zh-TW": d.textZh, en: d.textEn || d.textZh } })),
    }));
  } catch (err) {
    console.error("[serverData] getIpCharacters returned empty (DB unreachable):", err);
    return [];
  }
}

// ── 演習提醒（行事曆自動算出來的公告裡，唯一沒有資料庫來源的部分，見上面
//    schema 的說明）───────────────────────────────────────────────────────

export type DrillNotice = {
  start: string;
  end: string;
  title: Localized;
  body: Localized;
  generalBody: Localized;
};

const DEFAULT_DRILL_NOTICE: DrillNotice = {
  start: "2026-08-05",
  end: "2026-08-14",
  title: { "zh-TW": "演習提醒", en: "Drill Reminder" },
  body: {
    "zh-TW":
      "8/5～8/14 為漢光42號演習期間，其中 8/7～8/13 各地將分區實施城鎮韌性（防空）演習，期間可能有警報測試、人車管制，請留意官方公告與所在地區時段。",
    en: "Aug 5–14 is the Han Kuang No. 42 exercise period, with the City Resilience (air defense) drill held region-by-region across Aug 7–13 — expect alarm tests and brief traffic/pedestrian control. Please follow official announcements for your area's exact time slot.",
  },
  generalBody: {
    "zh-TW": "7、8 月為台灣演習與防災宣導較密集的時期，請留意學校及官方公告。",
    en: "July and August are Taiwan's busiest months for civil-defense drills and preparedness campaigns — please keep an eye on notices from your school and official announcements.",
  },
};

export const getDrillNotice = cache(async (): Promise<DrillNotice> => {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { id: "default" } });
    if (!row || !row.drillBodyZh?.trim()) return DEFAULT_DRILL_NOTICE;
    return {
      start: row.drillStart || DEFAULT_DRILL_NOTICE.start,
      end: row.drillEnd || DEFAULT_DRILL_NOTICE.end,
      title: { "zh-TW": row.drillTitleZh, en: row.drillTitleEn },
      body: { "zh-TW": row.drillBodyZh, en: row.drillBodyEn || row.drillBodyZh },
      generalBody: { "zh-TW": row.drillGeneralBodyZh, en: row.drillGeneralBodyEn || row.drillGeneralBodyZh },
    };
  } catch (err) {
    console.error("[serverData] getDrillNotice fell back to defaults:", err);
    return DEFAULT_DRILL_NOTICE;
  }
});

// ── 網站外觀（/admin/appearance）─────────────────────────────────────────

export type SiteAppearance = {
  siteNameZh: string;
  siteNameEn: string;
  subtitleZh: string;
  subtitleEn: string;
  heroTitleZh: string;
  heroTitleEn: string;
  popularTitleZh: string;
  popularTitleEn: string;
  popularSubtitleZh: string;
  popularSubtitleEn: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  cardColor: string;
  buttonColor: string;
  navbarColor: string;
  footerColor: string;
  logoUrl: string | null;
  homeHeroUrl: string | null;
  homeBackgroundUrl: string | null;
  homeDecorationUrl: string | null;
  ipCharacter1Url: string | null;
  ipCharacter2Url: string | null;
  ipCharacter3Url: string | null;
  footerText: string;
};

const DEFAULT_APPEARANCE: SiteAppearance = {
  siteNameZh: "南得遇見你",
  siteNameEn: "Exchange Compass",
  subtitleZh: "",
  subtitleEn: "",
  heroTitleZh: "",
  heroTitleEn: "",
  popularTitleZh: "",
  popularTitleEn: "",
  popularSubtitleZh: "",
  popularSubtitleEn: "",
  primaryColor: "#84bed7",
  secondaryColor: "#2a6ea2",
  backgroundColor: "#FAFAF7",
  textColor: "#1B1B1B",
  cardColor: "#FFFFFF",
  buttonColor: "#2a6ea2", // 現在是「特別註釋文字顏色」，欄位名稱沿用舊的沒改，避免多一次 schema 搬遷
  navbarColor: "#FAFAF7",
  footerColor: "#FFFFFF",
  logoUrl: null,
  homeHeroUrl: null,
  homeBackgroundUrl: null,
  homeDecorationUrl: null,
  ipCharacter1Url: null,
  ipCharacter2Url: null,
  ipCharacter3Url: null,
  footerText: "",
};

export const getSiteAppearance = cache(async (): Promise<SiteAppearance> => {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_APPEARANCE;
    return {
      siteNameZh: row.siteNameZh || DEFAULT_APPEARANCE.siteNameZh,
      siteNameEn: row.siteNameEn || DEFAULT_APPEARANCE.siteNameEn,
      subtitleZh: row.subtitleZh,
      subtitleEn: row.subtitleEn,
      heroTitleZh: row.heroTitleZh,
      heroTitleEn: row.heroTitleEn,
      popularTitleZh: row.popularTitleZh,
      popularTitleEn: row.popularTitleEn,
      popularSubtitleZh: row.popularSubtitleZh,
      popularSubtitleEn: row.popularSubtitleEn,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      backgroundColor: row.backgroundColor,
      textColor: row.textColor,
      cardColor: row.cardColor,
      buttonColor: row.buttonColor,
      navbarColor: row.navbarColor,
      footerColor: row.footerColor,
      logoUrl: row.logoUrl,
      homeHeroUrl: row.homeHeroUrl,
      homeBackgroundUrl: row.homeBackgroundUrl,
      homeDecorationUrl: row.homeDecorationUrl,
      ipCharacter1Url: row.ipCharacter1Url,
      ipCharacter2Url: row.ipCharacter2Url,
      ipCharacter3Url: row.ipCharacter3Url,
      footerText: row.footerText,
    };
  } catch (err) {
    console.error("[serverData] getSiteAppearance fell back to defaults:", err);
    return DEFAULT_APPEARANCE;
  }
});

// ── 手機版首頁設定（/admin/mobile）───────────────────────────────────────

export type MobileHomeSettings = { showQuickLinks: boolean; showIpRow: boolean; showAnnouncements: boolean };
export type MobileIpCharacterSettings = {
  id: "characterA" | "characterB" | "characterC";
  isVisible: boolean;
  order: number;
  sizeScale: number;
  animationEnabled: boolean;
  animationAmplitude: number;
  animationDuration: number;
};

const DEFAULT_MOBILE_HOME_SETTINGS: MobileHomeSettings = {
  showQuickLinks: true,
  showIpRow: true,
  showAnnouncements: true,
};

const DEFAULT_MOBILE_IP_SETTINGS: MobileIpCharacterSettings[] = [
  { id: "characterA", isVisible: true, order: 0, sizeScale: 1, animationEnabled: true, animationAmplitude: 10, animationDuration: 3 },
  { id: "characterB", isVisible: true, order: 1, sizeScale: 1, animationEnabled: true, animationAmplitude: 10, animationDuration: 3.4 },
  { id: "characterC", isVisible: true, order: 2, sizeScale: 1, animationEnabled: true, animationAmplitude: 10, animationDuration: 3.8 },
];

export async function getMobileHomeSettings(): Promise<MobileHomeSettings> {
  try {
    const row = await prisma.mobileHomeSetting.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_MOBILE_HOME_SETTINGS;
    return { showQuickLinks: row.showQuickLinks, showIpRow: row.showIpRow, showAnnouncements: row.showAnnouncements };
  } catch (err) {
    console.error("[serverData] getMobileHomeSettings fell back to defaults:", err);
    return DEFAULT_MOBILE_HOME_SETTINGS;
  }
}

export async function getMobileIpCharacterSettings(): Promise<MobileIpCharacterSettings[]> {
  try {
    const rows = await prisma.mobileIpCharacterSetting.findMany({ orderBy: { order: "asc" } });
    if (rows.length === 0) return DEFAULT_MOBILE_IP_SETTINGS;
    // 保證一定回傳三隻角色的設定，即使資料庫裡少了某一隻（例如剛升級還沒補資料）。
    return DEFAULT_MOBILE_IP_SETTINGS.map((fallback) => {
      const match = rows.find((r) => r.id === fallback.id);
      return match
        ? {
            id: fallback.id,
            isVisible: match.isVisible,
            order: match.order,
            sizeScale: match.sizeScale,
            animationEnabled: match.animationEnabled,
            animationAmplitude: match.animationAmplitude,
            animationDuration: match.animationDuration,
          }
        : fallback;
    });
  } catch (err) {
    console.error("[serverData] getMobileIpCharacterSettings fell back to defaults:", err);
    return DEFAULT_MOBILE_IP_SETTINGS;
  }
}

// ── 關於我們（/about 頁面最上方的理念說明）──────────────────────────────

const ABOUT_FALLBACK = {
  title: { "zh-TW": "網站理念", en: "Our Mission" },
  body: {
    "zh-TW":
      "南得遇見你由一群曾經歷交換生活的學生與工程師共同創立。我們深知第一次落地陌生國家時，面對租屋、健保、交通與語言的手足無措——因此打造這個平台，把散落各處的資訊整理成一站式的生活指南。",
    en: "南得遇見你 (Nán Dé Yùjiàn Nǐ) was founded by former exchange students and engineers who remember the disorientation of landing in a new country — figuring out housing, health insurance, transit, and language all at once. We built this platform to turn scattered information into one clear, one-stop guide.",
  },
};

export async function getAboutMission(): Promise<{ title: Localized; body: Localized }> {
  try {
    const row = await prisma.aboutContent.findUnique({ where: { id: "default" } });
    if (!row || !row.titleZh?.trim() || !row.contentZh?.trim()) return ABOUT_FALLBACK;
    return {
      title: { "zh-TW": row.titleZh, en: row.titleEn || row.titleZh },
      body: { "zh-TW": row.contentZh, en: row.contentEn || row.contentZh },
    };
  } catch (err) {
    console.error("[serverData] getAboutMission fell back to default copy:", err);
    return ABOUT_FALLBACK;
  }
}

export type AboutContact = {
  title: Localized | null;
  body: Localized | null;
  email: string;
  phone: string;
  address: string;
  socialLinks: { label: string; url: string }[];
};

export async function getAboutContact(): Promise<AboutContact> {
  try {
    const row = await prisma.aboutContent.findUnique({ where: { id: "default" } });
    if (!row) return { title: null, body: null, email: "", phone: "", address: "", socialLinks: [] };
    return {
      title: row.contactTitleZh ? { "zh-TW": row.contactTitleZh, en: row.contactTitleEn || row.contactTitleZh } : null,
      body: row.contactBodyZh ? { "zh-TW": row.contactBodyZh, en: row.contactBodyEn || row.contactBodyZh } : null,
      email: row.email,
      phone: row.phone,
      address: row.address,
      socialLinks: fromJsonField<{ label: string; url: string }[]>(row.socialLinksJson, []),
    };
  } catch (err) {
    console.error("[serverData] getAboutContact returned empty (DB unreachable):", err);
    return { title: null, body: null, email: "", phone: "", address: "", socialLinks: [] };
  }
}

export type AboutSectionData = { id: string; title: Localized | null; body: Localized };

export async function getAboutSections(): Promise<AboutSectionData[]> {
  try {
    const rows = await prisma.aboutSection.findMany({ where: { isVisible: true }, orderBy: { order: "asc" } });
    return rows.map((s) => ({
      id: s.id,
      title: stageTitleFrom(s.titleZh, s.titleEn),
      body: { "zh-TW": s.contentZh, en: s.contentEn || s.contentZh },
    }));
  } catch (err) {
    console.error("[serverData] getAboutSections returned empty (DB unreachable):", err);
    return [];
  }
}

export type TeamMemberData = { id: string; name: Localized; role: Localized | null; bio: Localized | null; photo: string | null };

export async function getTeamMembers(): Promise<TeamMemberData[]> {
  try {
    const rows = await prisma.teamMember.findMany({ where: { isVisible: true }, orderBy: { order: "asc" } });
    return rows.map((m) => ({
      id: m.id,
      name: { "zh-TW": m.nameZh, en: m.nameEn || m.nameZh },
      role: m.roleZh ? { "zh-TW": m.roleZh, en: m.roleEn || m.roleZh } : null,
      bio: m.bioZh ? { "zh-TW": m.bioZh, en: m.bioEn || m.bioZh } : null,
      photo: m.photo,
    }));
  } catch (err) {
    console.error("[serverData] getTeamMembers returned empty (DB unreachable):", err);
    return [];
  }
}

export type PartnerData = { id: string; name: Localized; description: Localized | null; logo: string | null; websiteUrl: string };

export async function getPartners(): Promise<PartnerData[]> {
  try {
    const rows = await prisma.partner.findMany({ where: { isVisible: true }, orderBy: { order: "asc" } });
    return rows.map((p) => ({
      id: p.id,
      name: { "zh-TW": p.nameZh, en: p.nameEn || p.nameZh },
      description: p.descriptionZh ? { "zh-TW": p.descriptionZh, en: p.descriptionEn || p.descriptionZh } : null,
      logo: p.logo,
      websiteUrl: p.websiteUrl,
    }));
  } catch (err) {
    console.error("[serverData] getPartners returned empty (DB unreachable):", err);
    return [];
  }
}

// 常駐公告（type="permanent"）只要 isPublished 就一直顯示；節假日公告
// （type="holiday"）除了 isPublished，還要 today 落在 startDate ~ endDate
// 之間才顯示。兩種公告合併成同一份清單回傳，不是「有節假日公告就蓋掉常駐
// 公告」——activePermanentAnnouncements 和 activeHolidayAnnouncements 都會
// 進到最後的清單裡，用 order 決定顯示順序。
export async function getPublishedAnnouncements(): Promise<AdminAnnouncement[]> {
  try {
    const now = new Date();

    const [activePermanentAnnouncements, activeHolidayAnnouncements] = await Promise.all([
      prisma.announcement.findMany({
        where: { isPublished: true, type: "permanent" },
        orderBy: [{ order: "asc" }, { publishDate: "desc" }],
      }),
      prisma.announcement.findMany({
        where: {
          isPublished: true,
          type: "holiday",
          OR: [
            { startDate: null, endDate: null },
            { startDate: { lte: now }, endDate: { gte: now } },
            { startDate: { lte: now }, endDate: null },
            { startDate: null, endDate: { gte: now } },
          ],
        },
        orderBy: [{ order: "asc" }, { publishDate: "desc" }],
      }),
    ]);

    const rows = [...activePermanentAnnouncements, ...activeHolidayAnnouncements].slice(0, 10);
    // 文字連結（獨立資料表）：讀不到（資料表尚未建立等）就當作沒有連結，公告照常顯示
    const linkSets = new Map<string, ReturnType<typeof parseLinkSetRow>>();
    try {
      const sets = await (prisma as any).announcementLinkSet.findMany({ where: { announcementId: { in: rows.map((r: { id: string }) => r.id) } } });
      for (const row of sets) linkSets.set(row.announcementId, parseLinkSetRow(row));
    } catch {
      /* ignore */
    }
    return rows.map((a) => {
      const links = toLinkViews(linkSets.get(a.id));
      return {
        id: a.id,
        title: { "zh-TW": a.titleZh, en: a.titleEn || a.titleZh },
        body: { "zh-TW": a.contentZh, en: a.contentEn || a.contentZh },
        image: a.image,
        ...(links.length ? { links } : {}),
      };
    });
  } catch (err) {
    console.error("[serverData] getPublishedAnnouncements returned empty (DB unreachable):", err);
    return [];
  }
}
