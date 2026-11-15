"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * 「生活」／「校園」兩個中文學習分區目前先共用這個空白入口頁——之後要
 * 加關卡/課程內容，直接在這個元件裡（或依 trackKey 分開兩個元件）擴充
 * 就好，入口頁（ChineseHomeContent）跟路由結構都不需要再動。
 */
export default function ChineseTrackPlaceholder({ trackKey }: { trackKey: "life" | "campus" }) {
  const { t } = useLanguage();
  const label = trackKey === "life" ? t("chinese_entry_life") : t("chinese_entry_campus");

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
      <Link href="/chinese" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {t("chinese_home_title")}
      </Link>

      <span className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-transit-500/10 text-transit-600 dark:text-transit-300">
        <Sparkles size={28} />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold text-ink-900 dark:text-white">{label}</h1>
      <p className="mt-3 text-ink-400 leading-relaxed">{t("coming_soon_body")}</p>
    </div>
  );
}
