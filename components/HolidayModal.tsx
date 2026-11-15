"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarEvent, LangCode } from "@/lib/types";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";

const weekdayZh = ["日", "一", "二", "三", "四", "五", "六"];

function formatFullDate(dateISO: string, lang: LangCode) {
  const d = new Date(dateISO + "T00:00:00");
  if (lang === "zh-TW") {
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日（星期${weekdayZh[d.getDay()]}）`;
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

/**
 * 節日小圖：固定方框（手機約 64–80px、桌面 100px）、object-contain 完整顯示不裁切不拉伸。
 * 圖片載入失敗時整塊不顯示（不留破圖、空框或佔位圖）。
 */
function HolidayImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div
      data-testid="holiday-modal-image"
      className="shrink-0 flex items-center justify-center h-16 w-16 min-[400px]:h-20 min-[400px]:w-20 sm:h-[100px] sm:w-[100px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export default function HolidayModal({ event, onClose }: { event: CalendarEvent | null; onClose: () => void }) {
  const { t, lang } = useLanguage();

  useEffect(() => {
    if (!event) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="holiday-modal-title"
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard shadow-soft dark:shadow-softdark p-6 sm:p-8"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 sm:top-6 sm:right-6 h-9 w-9 flex items-center justify-center rounded-full text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5 shrink-0"
            >
              <X size={18} />
            </button>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="pr-10">
              <span
                className={
                  event.isHoliday
                    ? "inline-flex items-center gap-1.5 rounded-full bg-lantern-500/10 text-lantern-600 dark:text-lantern-300 text-xs font-medium px-3 py-1"
                    : "inline-flex items-center gap-1.5 rounded-full bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-300 text-xs font-medium px-3 py-1"
                }
              >
                {event.isHoliday ? t("calendar_holiday_badge") : t("calendar_memorial_badge")}
              </span>

              {/* 名稱＋日期在左（原位置、原字級），小圖在名稱右側；名稱太長會在自己的欄內換行，不會和圖片重疊 */}
              <div className="mt-3 flex items-start gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h3 id="holiday-modal-title" className="font-display text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white break-words">
                    {pick(event.name, lang)}
                  </h3>
                  <p className="text-sm text-ink-400 mt-1.5">{formatFullDate(event.date, lang)}</p>
                </div>
                {event.image && <HolidayImage key={event.image} src={event.image} />}
              </div>

              {event.tag && (
                <div className="mt-3 rounded-lg bg-ink-50 dark:bg-white/5 px-3 py-2 text-xs font-medium text-ink-600 dark:text-ink-200 inline-block">
                  {pick(event.tag, lang)}
                </div>
              )}
            </div>

            {/* ── 節日介紹 ───────────────────────────────────────────── */}
            <div className="mt-6 pt-6 border-t border-ink-100 dark:border-white/10">
              <h4 className="font-display font-semibold text-sm uppercase tracking-wide text-transit-600 dark:text-transit-300">
                {t("calendar_modal_description_label")}
              </h4>
              <p className="mt-2 text-sm sm:text-base text-ink-600 dark:text-ink-100 leading-relaxed">
                {pick(event.description, lang)}
              </p>
            </div>

            {/* ── 節日由來 ───────────────────────────────────────────── */}
            {event.origin && (
              <div className="mt-6 pt-6 border-t border-ink-100 dark:border-white/10">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wide text-transit-600 dark:text-transit-300">
                  {t("calendar_modal_origin_label")}
                </h4>
                <p className="mt-2 text-sm sm:text-base text-ink-600 dark:text-ink-100 leading-relaxed">
                  {pick(event.origin, lang)}
                </p>
              </div>
            )}

            {/* ── 台灣怎麼過？ ───────────────────────────────────────── */}
            {event.taiwanCustoms && event.taiwanCustoms.length > 0 && (
              <div className="mt-6 pt-6 border-t border-ink-100 dark:border-white/10">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wide text-lantern-600 dark:text-lantern-300">
                  {t("calendar_modal_customs_label")}
                </h4>
                <ul className="mt-2.5 space-y-1.5">
                  {event.taiwanCustoms.map((custom, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm sm:text-base text-ink-600 dark:text-ink-100 leading-relaxed">
                      <span className="mt-2 h-1 w-1 rounded-full bg-lantern-500 shrink-0" />
                      {pick(custom, lang)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── 資料來源 ───────────────────────────────────────────── */}
            {event.source && (
              <div className="mt-6 pt-4 border-t border-ink-100 dark:border-white/10">
                <p className="text-xs text-ink-400">
                  {t("calendar_modal_source_label")}：{pick(event.source, lang)}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
