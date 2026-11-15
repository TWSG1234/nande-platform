"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import CalendarWidget from "@/components/CalendarWidget";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";
import { CalendarEvent } from "@/lib/types";
import { DrillNotice } from "@/lib/serverData";

export default function CalendarContent({ events, drillNotice }: { events: CalendarEvent[]; drillNotice: DrillNotice }) {
  const { t, lang } = useLanguage();
  const [cursor, setCursor] = useState(new Date());

  // Driven by the MONTH CURRENTLY BEING VIEWED (not necessarily today) — flip
  // between months with the calendar's own prev/next controls and this banner
  // updates immediately. Deliberately month-only, not date-specific: see
  // drillNotice.ts's generalBody comment for why.
  const viewedMonth = cursor.getMonth() + 1;
  const showDrillNotice = viewedMonth === 7 || viewedMonth === 8;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader eyebrow="Taiwan Calendar" title={t("calendar_title")} subtitle={t("calendar_subtitle")} />

      {showDrillNotice && (
        <div className="mt-6 flex items-start gap-3 rounded-xl2 border border-transit-200 dark:border-transit-500/30 bg-transit-50 dark:bg-transit-500/10 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transit-700 text-white">
            <ShieldAlert size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900 dark:text-white">{pick(drillNotice.title, lang)}</p>
            <p className="text-xs text-ink-600 dark:text-ink-200 mt-1 leading-relaxed">
              {pick(drillNotice.generalBody, lang)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <CalendarWidget full cursor={cursor} onCursorChange={setCursor} events={events} />
      </div>
    </div>
  );
}
