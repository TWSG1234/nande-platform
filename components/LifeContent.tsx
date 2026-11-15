"use client";

import SectionHeader from "@/components/SectionHeader";
import InfoCard, { DecorStyle } from "@/components/InfoCard";
import { LifeCategory } from "@/lib/types";
import type { DecorImage } from "@/lib/infoBoxDecor";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";

export default function LifeContent({ categories, decor = {} }: { categories: LifeCategory[]; decor?: Record<string, DecorImage[]> }) {
  const { t, lang } = useLanguage();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <DecorStyle />
      <SectionHeader eyebrow="Life Guide" title={t("section_life_title")} subtitle={t("section_life_subtitle")} />
      <p className="mt-4 text-sm text-ink-400">{t("life_category_note")}</p>

      <div className="mt-8 space-y-10">
        {categories.map((cat) => (
          <div key={cat.id} data-testid="life-category" data-category-id={cat.id}>
            <h3 className="font-display font-semibold text-lg text-ink-900 dark:text-white">{pick(cat.name, lang)}</h3>
            {cat.description && pick(cat.description, lang) && <p className="mt-1 text-sm text-ink-400">{pick(cat.description, lang)}</p>}
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.items.map((item) => (
                <InfoCard key={item.id} testId="life-card" boxId={item.id} href={`/life/${item.id}`} title={pick(item.title, lang)} description={pick(item.detail, lang)} images={decor[item.id]} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
