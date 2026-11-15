"use client";

import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { ChineseLevel, ChineseCategoryId, LangCode } from "@/lib/types";
import { pick } from "@/lib/i18n/pick";

export default function LevelPath({
  categoryId,
  levels,
  lang,
  levelLabel,
}: {
  categoryId: ChineseCategoryId;
  levels: ChineseLevel[];
  lang: LangCode;
  /** e.g. "Level" (en) or "第" (zh-TW, combined with a trailing 關 inside) */
  levelLabel: (n: number) => string;
}) {
  return (
    <div className="relative mt-4">
      {/* connecting path line */}
      <div
        aria-hidden
        className="absolute left-6 sm:left-1/2 top-6 bottom-6 w-1 sm:-translate-x-1/2 rounded-full bg-gradient-to-b from-transit-300 via-lantern-300 to-lantern-500 dark:from-transit-700 dark:via-lantern-700 dark:to-lantern-700 opacity-60"
      />

      <ol className="relative space-y-5">
        {levels.map((lvl, i) => {
          const alignRight = i % 2 === 1;
          return (
            <li key={lvl.id} className={clsx("sm:flex", alignRight ? "sm:justify-end" : "sm:justify-start")}>
              <Link
                href={`/chinese/${categoryId}/${lvl.level}`}
                className={clsx(
                  "group relative flex items-center gap-4 rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard pl-4 pr-5 py-4 hover:shadow-soft dark:hover:shadow-softdark hover:-translate-y-0.5 transition-all sm:w-[calc(50%-28px)]"
                )}
              >
                <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-transit-500 to-transit-600 text-white font-display font-bold shadow-soft ring-4 ring-canvas-light dark:ring-canvas-dark">
                  {lvl.level}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-lantern-600 dark:text-lantern-300">{levelLabel(lvl.level)}</p>
                  <p className="font-display font-semibold text-ink-900 dark:text-white leading-snug break-words">
                    {pick(lvl.title, lang)}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="ml-auto shrink-0 text-ink-400 group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
