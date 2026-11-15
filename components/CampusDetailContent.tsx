"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Lightbulb, MapPinned } from "lucide-react";
import { CampusSpot } from "@/lib/types";
import { campusCategoryLabel } from "@/lib/data/mockCampus";
import type { Localized } from "@/lib/types";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";

export default function CampusDetailContent({ spot, categoryName }: { spot: CampusSpot; categoryName?: Localized }) {
  const { t, lang } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <Link href="/campus" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {t("nav_campus")}
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-transit-500/10 text-transit-600 dark:text-transit-300">
          <MapPinned size={22} />
        </span>
        <div>
          <span className="text-xs font-medium text-lantern-600 dark:text-lantern-300">
            {t("campus_category_label")} · {pick(categoryName ?? campusCategoryLabel[spot.category] ?? { "zh-TW": "", en: "" }, lang)}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">{pick(spot.name, lang)}</h1>
        </div>
      </div>

      {spot.image && (
        <div className="mt-6 overflow-hidden rounded-xl2 border border-ink-100 dark:border-white/10 bg-ink-50 dark:bg-white/5" data-testid="campus-spot-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spot.image} alt={pick(spot.name, lang)} className="mx-auto max-h-96 w-auto max-w-full object-contain" />
        </div>
      )}

      {spot.details && (
        <p className="mt-6 text-ink-600 dark:text-ink-100 leading-relaxed text-base whitespace-pre-line">
          {pick(spot.details, lang)}
        </p>
      )}

      {spot.schoolTimes && spot.schoolTimes.length > 0 && (
        // 各校時間只出現在這個項目自己的詳情頁（介紹內容下方），校園座標主頁不顯示。
        // 資料來自這筆資訊格自己的 schoolTimes，所以升旗只會看到升旗的時間、午休
        // 只會看到午休的時間。學校名稱自動換行不截斷，時間不拆行。
        <div className="mt-8 border-t border-ink-100 dark:border-white/10 pt-6">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
            {lang === "zh-TW" ? `各校${spot.name["zh-TW"]}時間` : `${spot.name.en} times by school`}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {spot.schoolTimes.map((st) => (
              <div
                key={st.school}
                className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-4"
              >
                <p className="text-sm leading-snug text-ink-600 dark:text-ink-100">{st.school}</p>
                <p className="mt-1.5 whitespace-nowrap font-display text-lg font-bold text-annotation">{st.time}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {spot.mainResponsibility && (
        <p className="mt-6 text-ink-600 dark:text-ink-100 leading-relaxed text-base">
          <span className="font-semibold text-ink-900 dark:text-white">{t("main_responsibility_label")}：</span>
          {pick(spot.mainResponsibility, lang)}
        </p>
      )}

      {spot.exchangeStudentMayEncounter && spot.exchangeStudentMayEncounter.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold text-ink-900 dark:text-white">{t("may_encounter_label")}</p>
          <ul className="mt-2 space-y-1.5">
            {spot.exchangeStudentMayEncounter.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-ink-600 dark:text-ink-100 leading-relaxed">
                <span className="mt-2 h-1 w-1 rounded-full bg-transit-500 shrink-0" />
                {pick(item, lang)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        {spot.hours && (
          <div className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
              <Clock size={13} /> {t("hours_label")}
            </p>
            <p className="mt-1 text-sm font-medium text-ink-900 dark:text-white">{pick(spot.hours, lang)}</p>
          </div>
        )}
        {spot.tips && (
          <div className="rounded-xl2 border border-lantern-200 dark:border-lantern-500/30 bg-lantern-50 dark:bg-lantern-500/10 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-lantern-600 dark:text-lantern-300">
              <Lightbulb size={13} /> {t("tips_label")}
            </p>
            <p className="mt-1 text-sm text-ink-700 dark:text-ink-100">{pick(spot.tips, lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
