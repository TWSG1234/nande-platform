"use client";

import Link from "next/link";
import {
  ArrowLeft,
  UtensilsCrossed,
  Bus,
  Receipt,
  CircleHelp,
  Lightbulb,
  Landmark,
  ExternalLink,
} from "lucide-react";
import { LifeCategory, LifeItem } from "@/lib/types";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";

const iconMap = { UtensilsCrossed, Bus, Receipt, CircleHelp, Lightbulb, Landmark };

export default function LifeDetailContent({ item, category }: { item: LifeItem; category: LifeCategory }) {
  const { t, lang } = useLanguage();
  const Icon = iconMap[category.icon as keyof typeof iconMap] ?? CircleHelp;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <Link href="/life" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {t("nav_life")}
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-lantern-500/10 text-lantern-600 dark:text-lantern-300">
          <Icon size={22} />
        </span>
        <div>
          <span className="text-xs font-medium text-lantern-600 dark:text-lantern-300">{pick(category.name, lang)}</span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">{pick(item.title, lang)}</h1>
        </div>
      </div>

      {item.image && (
        <div className="mt-6 overflow-hidden rounded-xl2 border border-ink-100 dark:border-white/10 bg-ink-50 dark:bg-white/5" data-testid="life-item-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={pick(item.title, lang)} className="mx-auto max-h-96 w-auto max-w-full object-contain" />
        </div>
      )}

      <p className="mt-6 text-ink-600 dark:text-ink-100 leading-relaxed text-base whitespace-pre-line">
        {pick(item.fullDetail, lang)}
      </p>

      {item.tip && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl2 border border-lantern-500/20 bg-lantern-500/5 p-4">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-lantern-600 dark:text-lantern-300" />
          <p className="text-sm text-ink-600 dark:text-ink-100 leading-relaxed">{pick(item.tip, lang)}</p>
        </div>
      )}

      {item.officialLinks && item.officialLinks.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {item.officialLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-transit-500/30 bg-transit-500/5 px-4 py-2 text-sm font-medium text-transit-600 dark:text-transit-300 transition hover:bg-transit-500/10"
            >
              {pick(link.label, lang)}
              <ExternalLink size={13} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
