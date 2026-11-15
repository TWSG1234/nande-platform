"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import DrinkIllustration from "@/components/chinese/DrinkIllustration";
import VocabularyPanel from "@/components/chinese/VocabularyPanel";
import SentencePanel from "@/components/chinese/SentencePanel";
import { ChineseCategory, ChineseLevel } from "@/lib/types";
import { getLevelNavigation } from "@/lib/data/chineseLearning";
import { useLanguage } from "@/context/LanguageContext";

function formatLevelLabel(lang: "zh-TW" | "en", n: number) {
  return lang === "zh-TW" ? `第 ${n} 關` : `Level ${n}`;
}

export default function ChineseLevelContent({
  category,
  level,
  categories,
  levels,
}: {
  category: ChineseCategory;
  level: ChineseLevel;
  categories: ChineseCategory[];
  levels: ChineseLevel[];
}) {
  const { t, lang } = useLanguage();
  const nav = getLevelNavigation(category.id, level.level, categories, levels);

  const nextHref =
    nav.nextLevel !== null
      ? `/chinese/${category.id}/${nav.nextLevel}`
      : nav.finishAction === "finishCategory"
      ? `/chinese/${category.id}`
      : "/chinese";

  const nextLabel =
    nav.nextLevel !== null
      ? t("chinese_next_level")
      : nav.finishAction === "finishCategory"
      ? t("chinese_finish_category")
      : t("chinese_finish_all");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href={`/chinese/${category.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500"
      >
        <ArrowLeft size={13} /> {t("chinese_back_to_levels")}
      </Link>

      <div className="mt-4">
        <p className="text-xs font-medium text-lantern-600 dark:text-lantern-300">
          {category.nameZh} · {category.nameEn}
        </p>
        <p className="text-xs text-ink-400 mt-0.5">{formatLevelLabel(lang, level.level)}</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-ink-900 dark:text-white mt-1 break-words">
          {level.title["zh-TW"]}
          <span className="block text-base font-medium text-ink-400 mt-0.5">{level.title.en}</span>
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-stretch gap-6 lg:gap-8 mt-8">
        <div className="order-2 lg:order-1 lg:w-72 lg:shrink-0">
          <VocabularyPanel vocabulary={level.vocabulary} />
        </div>

        <div className="order-1 lg:order-2 flex justify-center lg:items-center">
          <DrinkIllustration drink={level.drink} className="w-40 sm:w-52 lg:w-56 shrink-0" />
        </div>

        <div className="order-3 lg:order-3 flex-1 lg:min-w-0">
          <SentencePanel sentences={level.sentences} />
        </div>

        <div className="order-4 lg:order-4 lg:w-44 lg:shrink-0 flex flex-col-reverse lg:flex-col gap-3 lg:justify-center lg:sticky lg:top-24 h-fit">
          <Link
            href={nextHref}
            className="flex items-center justify-center gap-1.5 rounded-full bg-lantern-500 hover:bg-lantern-600 text-white text-sm font-semibold px-5 py-3.5 lg:py-3 transition-colors shadow-soft"
          >
            {nextLabel} <ArrowRight size={15} />
          </Link>
          {nav.prevLevel !== null && (
            <Link
              href={`/chinese/${category.id}/${nav.prevLevel}`}
              className="flex items-center justify-center gap-1.5 rounded-full border border-ink-100 dark:border-white/10 text-ink-600 dark:text-ink-100 text-sm font-medium px-5 py-2.5 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={14} /> {t("chinese_prev_level")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
