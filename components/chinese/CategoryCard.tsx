import Link from "next/link";
import { Languages, School, Users, Sparkles, ArrowRight, type LucideIcon } from "lucide-react";
import { ChineseCategory, LangCode } from "@/lib/types";
import { pick } from "@/lib/i18n/pick";

const iconMap: Record<string, LucideIcon> = { Languages, School, Users, Sparkles };

export default function CategoryCard({
  category,
  lang,
  startLabel,
  levelsLabel,
}: {
  category: ChineseCategory;
  lang: LangCode;
  startLabel: string;
  levelsLabel: string;
}) {
  const Icon = iconMap[category.icon] ?? Sparkles;

  return (
    <Link
      href={`/chinese/${category.id}`}
      className="group relative overflow-hidden rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-6 sm:p-7 hover:shadow-soft dark:hover:shadow-softdark hover:-translate-y-1 active:translate-y-0 transition-all"
    >
      <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-lantern-500/10 group-hover:bg-lantern-500/20 transition-colors" aria-hidden />

      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-transit-500/10 text-transit-600 dark:text-transit-300 group-hover:bg-transit-500 group-hover:text-white transition-colors">
        <Icon size={26} />
      </span>

      <h3 className="relative mt-5 font-display text-xl font-bold text-ink-900 dark:text-white">
        {category.nameZh}
      </h3>
      <p className="relative text-sm font-medium text-lantern-600 dark:text-lantern-300">{category.nameEn}</p>
      <p className="relative mt-2.5 text-sm text-ink-400 leading-relaxed">{pick(category.description, lang)}</p>

      <div className="relative mt-5 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-400">{levelsLabel}</span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-transit-600 dark:text-transit-300 group-hover:gap-2 transition-all">
          {startLabel} <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}
