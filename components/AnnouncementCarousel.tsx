"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, PartyPopper, ShieldAlert, Landmark, Sparkles, Megaphone } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { GeneratedAnnouncement, Localized } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { pick } from "@/lib/i18n/pick";

const kindMeta: Record<GeneratedAnnouncement["kind"], { icon: typeof PartyPopper; color: string; label: Localized }> = {
  admin: { icon: Megaphone, color: "bg-lantern-600", label: { "zh-TW": "站方公告", en: "Announcement" } },
  holiday: { icon: PartyPopper, color: "bg-lantern-500", label: { "zh-TW": "假期提醒", en: "Holiday" } },
  drill: { icon: ShieldAlert, color: "bg-transit-700", label: { "zh-TW": "演習提醒", en: "Drill Reminder" } },
  memorial: { icon: Landmark, color: "bg-ink-600", label: { "zh-TW": "紀念日", en: "Memorial Day" } },
  fallback: { icon: Sparkles, color: "bg-transit-500", label: { "zh-TW": "站內推薦", en: "On the Site" } },
};

export default function AnnouncementCarousel({ list }: { list: GeneratedAnnouncement[] }) {
  const { t, lang } = useLanguage();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); // 滑鼠移入／鍵盤聚焦時暫停自動輪播，讓人有時間點連結

  // 第一頁的內容換了（例如日期跨日、行事曆更新）就回到第一頁，確保行事曆連動公告先被看到。
  const firstId = list[0]?.id;
  useEffect(() => {
    setIndex(0);
  }, [firstId]);

  useEffect(() => {
    if (list.length <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), 6000);
    return () => clearInterval(id);
  }, [list.length, paused]);

  const current = list[index] ?? list[0];
  if (!current) return null; // list is empty — nothing to show, rather than crash
  const Meta = kindMeta[current.kind];
  const Icon = Meta.icon;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard shadow-soft dark:shadow-softdark overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4">
        <h3 className="font-display font-semibold text-sm text-ink-800 dark:text-ink-50">
          {t("announcements_title")}
        </h3>
        {list.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous"
              onClick={() => setIndex((i) => (i - 1 + list.length) % list.length)}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-ink-50 dark:hover:bg-white/5 text-ink-400"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              aria-label="Next"
              onClick={() => setIndex((i) => (i + 1) % list.length)}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-ink-50 dark:hover:bg-white/5 text-ink-400"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3" style={{ minHeight: "clamp(6.5rem, 8vw, 18rem)" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-start gap-3">
              <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white", Meta.color)}>
                <Icon size={16} />
              </span>
              <div>
                <span className="text-[11px] font-medium text-ink-400">{pick(Meta.label, lang)}</span>
                <h4 className="font-semibold text-ink-900 dark:text-white text-sm leading-snug mt-0.5">
                  {pick(current.title, lang)}
                </h4>
                <p className="text-xs text-ink-400 mt-1.5 leading-relaxed line-clamp-2">{pick(current.body, lang)}</p>
                {current.links && current.links.length > 0 && (
                  // 只有這些個別文字可以點；公告卡片本身不是連結（沒有任何外層 <a> 或 onClick），所以不會有巢狀連結
                  <nav aria-label={lang === "en" ? "Related links" : "相關資訊"} data-testid="announcement-links" className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
                    <span className="text-ink-400">{lang === "en" ? "Related: " : "相關資訊："}</span>
                    {current.links.map((l, i) => {
                      const cls = "inline-block min-h-[28px] px-1.5 py-1 font-semibold underline-offset-2 hover:underline focus-visible:underline sm:min-h-0 sm:py-0.5";
                      const style = { color: l.color };
                      return (
                        <span key={l.id} className="inline-flex items-center">
                          {l.external ? (
                            <a href={l.href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
                              {pick(l.label, lang)}
                              <span className="sr-only">{lang === "en" ? " (opens in a new tab)" : "（在新分頁開啟）"}</span>
                            </a>
                          ) : (
                            <Link href={l.href} className={cls} style={style}>
                              {pick(l.label, lang)}
                            </Link>
                          )}
                          {i < current.links!.length - 1 && (
                            <span aria-hidden="true" className="text-ink-200">
                              ｜
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </nav>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {list.length > 1 && (
        <div className="flex items-center gap-1.5 px-5 pb-4">
          {list.map((a, i) => (
            <button
              key={a.id}
              aria-label={`Go to announcement ${i + 1}`}
              onClick={() => setIndex(i)}
              className={clsx(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-lantern-500" : "w-1.5 bg-ink-100 dark:bg-white/10"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
