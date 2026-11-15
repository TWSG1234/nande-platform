"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPinned, Route, Languages, ChevronRight } from "lucide-react";
import HeroBanner from "@/components/HeroBanner";
import AnnouncementCarousel from "@/components/AnnouncementCarousel";
import CalendarWidget from "@/components/CalendarWidget";
import SectionHeader from "@/components/SectionHeader";
import MrtConnector from "@/components/MrtConnector";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";
import { CampusSpot, LifeCategory, CalendarEvent, AdminAnnouncement, GeneratedAnnouncement } from "@/lib/types";
import { generateHomeAnnouncements, orderHomeAnnouncements } from "@/lib/announcementGenerator";
import type { DrillNotice } from "@/lib/serverData";
import { MobileHomeSettings, MobileIpCharacterSettings, SiteAppearance } from "@/lib/serverData";
import { HeroDialogue } from "@/components/HeroBanner";
import DecorationLayer from "@/components/home/DecorationLayer";
import DecorPreviewBridge from "@/components/home/DecorPreviewBridge";
import type { Decoration } from "@/lib/home/decorations";
import type { IpLayouts } from "@/lib/home/ipLayout";
import type { HeroImage } from "@/lib/home/ipImages";
import type { IpCharId } from "@/lib/home/ipLayout";

export default function HomeContent({
  campusSpots,
  lifeCategories,
  calendarEvents,
  adminAnnouncements,
  mobileHomeSettings,
  mobileIpCharacters,
  ipLayouts,
  heroImages,
  appearance,
  ipDialogues,
  drillNotice,
  decorations = [],
  initialCalendarAnnouncements,
}: {
  campusSpots: CampusSpot[];
  lifeCategories: LifeCategory[];
  calendarEvents: CalendarEvent[];
  adminAnnouncements: AdminAnnouncement[];
  mobileHomeSettings: MobileHomeSettings;
  mobileIpCharacters: MobileIpCharacterSettings[];
  ipLayouts: IpLayouts;
  heroImages: Record<IpCharId, HeroImage>;
  appearance: SiteAppearance;
  ipDialogues?: { characterA: HeroDialogue; characterB: HeroDialogue; characterC: HeroDialogue };
  /** 演習提醒（給行事曆自動提醒用；沒傳就用 generator 內建預設值） */
  drillNotice?: DrillNotice;
  decorations?: Decoration[];
  /** 伺服器端（台灣時區）先算好的行事曆連動公告，讓重新整理時第一頁一開始就正確。 */
  initialCalendarAnnouncements?: GeneratedAnnouncement[];
}) {
  const { t, lang } = useLanguage();
  // 後台預覽用：草稿裝飾（只在 ?decorPreview=1 的 iframe 內才會被設定；平常永遠是 null，使用資料庫的設定）
  const [previewItems, setPreviewItems] = useState<Decoration[] | null>(null);
  const onPreviewItems = useCallback((items: Decoration[]) => setPreviewItems(items), []);
  const shownDecorations = previewItems ?? decorations;

  const quickLinks = [
    { href: "/campus", icon: MapPinned, titleKey: "nav_campus" as const, descKey: "section_campus_subtitle" as const },
    { href: "/life", icon: Route, titleKey: "nav_life" as const, descKey: "section_life_subtitle" as const },
    { href: "/chinese", icon: Languages, titleKey: "nav_chinese" as const, descKey: "section_chinese_subtitle" as const },
  ];

  // A handful of featured campus spots + life items to showcase on the homepage.
  const featuredCampus = campusSpots.slice(0, 3);
  const featuredLife = lifeCategories.flatMap((c) => c.items).slice(0, 3);

  // 首頁公告順序：① 行事曆連動公告（今天是假日／連假即將到來／演習季／九二一等紀念日，
  // 見 lib/announcementGenerator.ts）固定在第一頁；② 後台管理的一般公告（常駐＋節假日，
  // 已在 getPublishedAnnouncements() 合併）依原順序接在後面。沒有行事曆連動公告時就只有②。
  // 伺服器端先用台灣時區算出初始值（app/page.tsx），瀏覽器載入後再依使用者的今天重算，
  // 所以重新整理時第一頁一開始就正確。不會把所有行事曆事件都變成公告，也不會刪除任何公告。
  const adminList: GeneratedAnnouncement[] = adminAnnouncements.map((a) => ({
    id: `admin-${a.id}`,
    kind: "admin" as const,
    title: a.title,
    body: a.body,
    ...(a.links?.length ? { links: a.links } : {}),
  }));
  const [generatedList, setGeneratedList] = useState<GeneratedAnnouncement[]>(initialCalendarAnnouncements ?? []);
  useEffect(() => {
    setGeneratedList(drillNotice ? generateHomeAnnouncements(new Date(), calendarEvents, drillNotice) : generateHomeAnnouncements(new Date(), calendarEvents));
  }, [calendarEvents, drillNotice]);
  // 行事曆連動公告固定排在第一頁，一般公告依原順序接在後面。
  const announcementList = orderHomeAnnouncements(generatedList, adminList);

  const heroTitle = appearance.heroTitleZh ? { "zh-TW": appearance.heroTitleZh, en: appearance.heroTitleEn || appearance.heroTitleZh } : null;
  const heroSubtitle = appearance.subtitleZh ? { "zh-TW": appearance.subtitleZh, en: appearance.subtitleEn || appearance.subtitleZh } : null;
  const popularTitle = appearance.popularTitleZh ? { "zh-TW": appearance.popularTitleZh, en: appearance.popularTitleEn || appearance.popularTitleZh } : null;
  const popularSubtitle = appearance.popularSubtitleZh
    ? { "zh-TW": appearance.popularSubtitleZh, en: appearance.popularSubtitleEn || appearance.popularSubtitleZh }
    : null;

  return (
    <div className="relative flex flex-col">
      {/* 首頁裝飾（body 區）：-z-10，固定在首頁底色之上、所有首頁內容之下；absolute 不佔排版、不攔截點擊 */}
      <DecorationLayer items={shownDecorations} area="body" />
      <DecorPreviewBridge onItems={onPreviewItems} />
      <div className="order-1">
        <HeroBanner
          decorations={<DecorationLayer items={shownDecorations} area="hero" />}
          mobileIpCharacters={mobileIpCharacters}
          ipLayouts={ipLayouts}
          heroImages={heroImages}
          hideMobileIp={!mobileHomeSettings.showIpRow}
          title={heroTitle ? pick(heroTitle, lang) : undefined}
          subtitle={heroSubtitle ? pick(heroSubtitle, lang) : undefined}
          siteName={appearance.siteNameZh}
          ipDialogues={ipDialogues}
        />
      </div>

      {mobileHomeSettings.showAnnouncements && (
        // 重要公告用「百分比」控制寬度：外層 section 只負責滿版（w-full）與疊在 Hero 底部的
        // 位置，內層 div 才是公告本身的寬度——手機 92%、平板 93%、桌面 94%，左右各留
        // 剩下的一半（對稱），沒有任何固定 px 的 width／max-width，所以螢幕變寬公告等比例
        // 變寬、變窄等比例變窄，1280／1920／2560 看起來的相對比例都一樣。
        // 順序：公告固定 order-2、三張卡片 order-3，手機與桌面都是「公告 → 三張卡片」；
        // 手機版公告上方留一點間距（mt-4），sm 以上維持原本壓在 Hero 底部的 -mt-10。
        <section className="order-2 mt-4 w-full sm:-mt-10 relative z-10">
          <div className="mx-auto w-[92%] sm:w-[93%] lg:w-[94%]">
            <AnnouncementCarousel list={announcementList} />
          </div>
        </section>
      )}



      {mobileHomeSettings.showQuickLinks && (
        <section className="order-3 mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-10 py-16">
          <MrtConnector stops={[t("nav_campus"), t("nav_life"), t("nav_chinese")]} activeIndex={0} className="mb-8" />
          <div className="grid gap-5 sm:grid-cols-3 lg:gap-8">
            {quickLinks.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-6 lg:min-h-[280px] lg:p-9 hover:shadow-soft dark:hover:shadow-softdark hover:-translate-y-0.5 transition-all"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-transit-500/10 text-transit-600 dark:text-transit-300">
                  <q.icon size={20} />
                </span>
                <h3 className="mt-4 font-display font-semibold text-ink-900 dark:text-white">{t(q.titleKey)}</h3>
                <p className="mt-1 text-sm text-ink-400 leading-relaxed">{t(q.descKey)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-transit-600 dark:text-transit-300 group-hover:gap-2 transition-all">
                  {t("explore_cta")} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="order-4 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <SectionHeader
          eyebrow="Popular × Calendar"
          title={popularTitle ? pick(popularTitle, lang) : t("home_popular_title")}
          subtitle={popularSubtitle ? pick(popularSubtitle, lang) : t("home_popular_subtitle")}
        />
        <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-6">
            <div>
              <h4 className="font-display font-semibold text-sm text-ink-800 dark:text-ink-50 mb-3">{t("nav_campus")}</h4>
              <div className="grid sm:grid-cols-3 gap-3">
                {featuredCampus.map((spot) => (
                  <Link
                    key={spot.id}
                    href={`/campus/${spot.id}`}
                    className="group rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-4 hover:shadow-soft dark:hover:shadow-softdark transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900 dark:text-white group-hover:text-transit-600 dark:group-hover:text-transit-300 transition-colors">
                        {pick(spot.name, lang)}
                      </p>
                      <ChevronRight size={14} className="text-ink-400 shrink-0 mt-0.5" />
                    </div>
                    <p className="mt-1 text-xs text-ink-400 line-clamp-2">{pick(spot.description, lang)}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-display font-semibold text-sm text-ink-800 dark:text-ink-50 mb-3">{t("nav_life")}</h4>
              <div className="grid sm:grid-cols-3 gap-3">
                {featuredLife.map((item) => (
                  <Link
                    key={item.id}
                    href={`/life/${item.id}`}
                    className="group rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-4 hover:shadow-soft dark:hover:shadow-softdark transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900 dark:text-white group-hover:text-transit-600 dark:group-hover:text-transit-300 transition-colors">
                        {pick(item.title, lang)}
                      </p>
                      <ChevronRight size={14} className="text-ink-400 shrink-0 mt-0.5" />
                    </div>
                    <p className="mt-1 text-xs text-ink-400 line-clamp-2">{pick(item.detail, lang)}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <CalendarWidget events={calendarEvents} />
          </div>
        </div>
      </section>
    </div>
  );
}
