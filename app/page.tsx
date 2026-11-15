import { getHomeDecorations } from "@/lib/home/decorationsDb";
import { getIpLayouts } from "@/lib/home/ipLayoutDb";
import { resolveHeroImages } from "@/lib/home/ipImages";
import HomeContent from "@/components/HomeContent";
import { generateHomeAnnouncements, taipeiToday } from "@/lib/announcementGenerator";
import {
  getCampusSpots,
  getLifeCategories,
  getCalendarEvents,
  getPublishedAnnouncements,
  getMobileHomeSettings,
  getMobileIpCharacterSettings,
  getSiteAppearance,
  getIpCharacters,
  getDrillNotice,
} from "@/lib/serverData";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [campusSpots, lifeCategories, calendarEvents, adminAnnouncements, mobileHomeSettings, mobileIpCharacters, appearance, ipCharacters, drillNotice, decorations] =
    await Promise.all([
      getCampusSpots(),
      getLifeCategories(),
      getCalendarEvents(),
      getPublishedAnnouncements(),
      getMobileHomeSettings(),
      getMobileIpCharacterSettings(),
      getSiteAppearance(),
      getIpCharacters(),
      getDrillNotice(),
      getHomeDecorations(), // 讀不到（資料表未建立）時回傳 []，首頁照舊
    ]);

  // 首頁 Hero 固定有 3 個角色位置。圖片：後台「網站外觀 → IP角色 1/2/3」上傳的優先，沒有才用 lib/data/heroCharacters.ts
  // 的內建圖（跟「IP角色管理」身分卡的圖片是不同素材）。位置／大小／角度：後台「IP 角色版面」的設定（桌機／平板／手機各自一組）。對應關係完全由管理員
  // 在 /admin/characters 的「首頁位置」欄位決定（homePosition），不是用
  // 陣列第幾筆或名字猜的——這樣管理頁改了哪一隻 IP，首頁顯示的一定是那
  // 一隻，不會錯位。每隻角色可能有好幾句回覆，全部傳給前端，實際點擊時
  // 由瀏覽器端隨機抽一句（抽機制必須在互動當下做，不能在伺服器端先選好）。
  const dialogueFor = (position: "characterA" | "characterB" | "characterC") => {
    const c = ipCharacters.find((ch) => ch.homePosition === position);
    if (!c) return null;
    return {
      lines: c.dialogueLines.map((d) => ({ zh: d.text["zh-TW"], en: d.text.en })),
      enabled: c.dialogueEnabled,
    };
  };
  const ipDialogues = {
    characterA: dialogueFor("characterA"),
    characterB: dialogueFor("characterB"),
    characterC: dialogueFor("characterC"),
  };

  const { layouts: ipLayouts } = await getIpLayouts(mobileIpCharacters.map((c) => ({ id: c.id, isVisible: c.isVisible, order: c.order, sizeScale: c.sizeScale })));
  const heroImages = resolveHeroImages(appearance);

  const initialCalendarAnnouncements = generateHomeAnnouncements(taipeiToday(), calendarEvents, drillNotice);

  return (
    <HomeContent
      campusSpots={campusSpots}
      lifeCategories={lifeCategories}
      calendarEvents={calendarEvents}
      adminAnnouncements={adminAnnouncements}
      mobileHomeSettings={mobileHomeSettings}
      mobileIpCharacters={mobileIpCharacters}
      ipLayouts={ipLayouts}
      heroImages={heroImages}
      appearance={appearance}
      ipDialogues={ipDialogues}
      drillNotice={drillNotice}
      decorations={decorations}
      initialCalendarAnnouncements={initialCalendarAnnouncements}
    />
  );
}
