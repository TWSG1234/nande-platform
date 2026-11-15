"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { calendarEvents } from "@/lib/data/mockCalendar";
import { useLanguage } from "@/context/LanguageContext";
import { pick } from "@/lib/i18n/pick";
import { CalendarEvent } from "@/lib/types";
import HolidayModal from "@/components/HolidayModal";

const weekdaysZh = ["日", "一", "二", "三", "四", "五", "六"];
const weekdaysEn = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CalendarWidget({
  full = false,
  cursor: controlledCursor,
  onCursorChange,
  events = calendarEvents,
}: {
  full?: boolean;
  /** Pass these two together to let a parent (e.g. the Calendar page) read/drive the viewed month. */
  cursor?: Date;
  onCursorChange?: (d: Date) => void;
  /** DB-sourced events from a Server Component parent; falls back to the static mock if omitted. */
  events?: CalendarEvent[];
}) {
  const { t, lang } = useLanguage();
  const today = useMemo(() => new Date(), []);
  const todayISO = useMemo(() => toISODate(today), [today]);
  const [internalCursor, setInternalCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const cursor = controlledCursor ?? internalCursor;
  const setCursor = onCursorChange ?? setInternalCursor;
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weekdays = lang === "en" ? weekdaysEn : weekdaysZh;

  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: { date: string | null; day: number | null }[] = [];
    for (let i = 0; i < startOffset; i++) arr.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ date: `${year}-${pad(month + 1)}-${pad(d)}`, day: d });
    }
    return arr;
  }, [year, month]);

  return (
    <div className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard shadow-soft dark:shadow-softdark p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-sm text-ink-800 dark:text-ink-50">{t("calendar_title")}</h3>
          <p className="text-xs text-ink-400 mt-0.5">{t("calendar_subtitle")}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-ink-50 dark:hover:bg-white/5 text-ink-400"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-medium w-24 text-center font-mono">
            {year}.{pad(month + 1)}
          </span>
          <button
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-ink-50 dark:hover:bg-white/5 text-ink-400"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-4">
        {weekdays.map((w, i) => (
          <span key={i} className="text-[11px] font-medium text-ink-400 py-1 text-center">
            {w}
          </span>
        ))}
        {cells.map((cell, i) => {
          const events = cell.date ? eventMap.get(cell.date) ?? [] : [];
          const isToday = cell.date === todayISO;
          return (
            <div
              key={i}
              className={clsx(
                "rounded-lg flex flex-col items-center gap-0.5 py-1 px-0.5",
                !cell.date && "invisible",
                full ? "min-h-[64px] sm:min-h-[78px]" : "min-h-[46px] sm:min-h-[56px]"
              )}
            >
              {cell.day && (
                <span
                  className={clsx(
                    "text-xs h-5 w-5 flex items-center justify-center rounded-full shrink-0",
                    isToday ? "bg-transit-500 text-white font-semibold" : "text-ink-700 dark:text-ink-100"
                  )}
                >
                  {cell.day}
                </span>
              )}
              <div className="flex flex-col gap-0.5 w-full items-center">
                {events.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setOpenEvent(e)}
                    title={pick(e.name, lang)}
                    className={clsx(
                      "w-full max-w-full rounded px-0.5 leading-tight text-center truncate transition-opacity hover:opacity-80",
                      full ? "text-[9px] sm:text-[10px] py-0.5" : "text-[7px] sm:text-[8px] py-px",
                      e.isHoliday
                        ? "bg-lantern-500/15 text-lantern-700 dark:bg-lantern-500/20 dark:text-lantern-300 font-medium"
                        : "bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-300"
                    )}
                  >
                    {pick(e.name, lang)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {full && (
        <div className="mt-4 flex flex-wrap gap-4 border-t border-ink-100 dark:border-white/10 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <span className="h-2.5 w-2.5 rounded bg-lantern-500/70" />
            {t("calendar_holiday_badge")}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <span className="h-2.5 w-2.5 rounded bg-ink-300 dark:bg-white/20" />
            {t("calendar_memorial_badge")}
          </span>
        </div>
      )}

      <HolidayModal event={openEvent} onClose={() => setOpenEvent(null)} />
    </div>
  );
}
