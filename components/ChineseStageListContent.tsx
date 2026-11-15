"use client";

import { stageName } from "@/lib/chinese/stageName";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ChineseStageSummary } from "@/lib/serverData";

export default function ChineseStageListContent({
  track,
  stages,
}: {
  track: "life" | "campus";
  stages: ChineseStageSummary[];
}) {
  const { t, lang } = useLanguage();
  const trackLabel = track === "life" ? t("chinese_entry_life") : t("chinese_entry_campus");

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
      <Link href="/chinese" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {t("chinese_home_title")}
      </Link>

      <h1 className="mt-3 font-display text-3xl font-bold text-ink-900 dark:text-white">{trackLabel}</h1>

      {/* 由上到下排列，不是橫向並排——桌面版、手機版都是同一套直式排列，
          不需要另外分桌面/手機兩套邏輯。 */}
      <div className="mt-8 flex flex-col gap-4">
        {stages.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6 text-center text-sm text-ink-400">
            {t("coming_soon_body")}
          </p>
        )}
        {stages.map((stage) => (
          <Link
            key={stage.id}
            href={`/chinese/${track}/${stage.id}`}
            className="group flex items-center justify-between rounded-2xl border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard px-6 py-6 shadow-soft dark:shadow-softdark transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div>
              <p className="text-xs font-medium text-annotation">
                {lang === "zh-TW" ? `第 ${stage.levelNumber} 關` : `Level ${stage.levelNumber}`}
              </p>
              <p className="mt-1 font-display text-xl font-bold text-ink-900 dark:text-white">
                {stageName(stage.title, stage.levelNumber, lang)}
              </p>
            </div>
            <ChevronRight size={20} className="text-ink-400 transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
