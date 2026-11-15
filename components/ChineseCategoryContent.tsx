"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LevelPath from "@/components/chinese/LevelPath";
import { ChineseCategory, ChineseLevel } from "@/lib/types";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";

function formatLevelLabel(lang: "zh-TW" | "en", n: number) {
  return lang === "zh-TW" ? `第 ${n} 關` : `Level ${n}`;
}

export default function ChineseCategoryContent({
  category,
  levels,
}: {
  category: ChineseCategory;
  levels: ChineseLevel[];
}) {
  const { t, lang } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <Link href="/chinese" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {t("chinese_back_to_categories")}
      </Link>

      <div className="mt-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">{category.nameZh}</h1>
        <p className="text-sm font-medium text-lantern-600 dark:text-lantern-300">{category.nameEn}</p>
        <p className="mt-2 text-sm text-ink-400 leading-relaxed max-w-xl">{pick(category.description, lang)}</p>
      </div>

      <LevelPath categoryId={category.id} levels={levels} lang={lang} levelLabel={(n) => formatLevelLabel(lang, n)} />
    </div>
  );
}
