"use client";

import Link from "next/link";
import { Coffee, GraduationCap, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * 中文學習區的全新入口頁——先只放「生活」／「校園」兩個大分區按鍵，其他
 * 舊版的分類/關卡/課程內容都先移除了。之後要在這兩個分區裡加課程內容，
 * 只需要在 /chinese/life、/chinese/campus 這兩個頁面裡繼續擴充，不需要
 * 動這裡的入口頁結構。
 *
 * 注意：這裡的「生活」「校園」是中文學習區自己的兩個學習分類，跟網站原本
 * 的「生活座標」（/life）、「校園座標」（/campus）是完全不同的頁面，只是
 * 剛好中文字一樣——連結目的地、頁面內容都不相通，不要搞混。
 */
export default function ChineseHomeContent() {
  const { t } = useLanguage();

  const entries = [
    {
      href: "/chinese/life",
      icon: Coffee,
      label: t("chinese_entry_life"),
      desc: t("chinese_entry_life_desc"),
    },
    {
      href: "/chinese/campus",
      icon: GraduationCap,
      label: t("chinese_entry_campus"),
      desc: t("chinese_entry_campus_desc"),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-900 dark:text-white">
          {t("chinese_home_title")}
        </h1>
        <p className="mt-3 text-ink-400">{t("chinese_home_subtitle")}</p>
      </div>

      {/* 桌面版左右並排（sm 以上），手機版上下排列（base，避免按鍵被擠窄）。
          按鍵底色直接用網站主色（bg-transit-500，已經接上 /admin/appearance
          的主色設定），不是另外寫死的顏色；hover 時換成輔助色，一樣是既有
          的顏色變數，沒有新增任何顏色。 */}
      <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:gap-8">
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="group flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-transit-600/20 bg-transit-500 px-8 py-14 sm:py-20 text-center shadow-soft dark:shadow-softdark transition-all hover:-translate-y-1 hover:bg-lantern-500 hover:shadow-lg"
          >
            <span className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/15 text-white">
              <entry.icon size={36} strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-display text-2xl sm:text-3xl font-bold text-white">{entry.label}</p>
              <p className="mt-1.5 text-sm text-white/80">{entry.desc}</p>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              {entry.label} <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
