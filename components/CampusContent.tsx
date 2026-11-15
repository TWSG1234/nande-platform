"use client";

import { Clock } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import InfoCard, { DecorStyle } from "@/components/InfoCard";
import { CampusSpot, Localized } from "@/lib/types";
import type { DecorImage } from "@/lib/infoBoxDecor";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";

/** 後台管理的大分類（id 是前台 id：school_units 在這裡是 "school-units"）。 */
export type CampusCategoryView = { id: string; name: Localized; description?: Localized };

export default function CampusContent({
  spots,
  categories,
  decor = {},
}: {
  spots: CampusSpot[];
  categories: CampusCategoryView[];
  decor?: Record<string, DecorImage[]>;
}) {
  const { t, lang } = useLanguage();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <DecorStyle />
      <SectionHeader eyebrow="Campus Guide" title={t("section_campus_title")} subtitle={t("section_campus_subtitle")} />
      <p className="mt-4 text-sm text-ink-400">{t("campus_all_spots_note")}</p>

      <div className="mt-8 space-y-10">
        {categories
          .filter((cat) => spots.some((s) => s.category === cat.id))
          .map((cat) => (
            <div key={cat.id} data-testid="campus-category" data-category-id={cat.id}>
              <h3 className="font-display font-semibold text-lg text-ink-900 dark:text-white">{pick(cat.name, lang)}</h3>
              {cat.description && pick(cat.description, lang) && <p className="mt-1 mb-4 text-sm text-ink-400">{pick(cat.description, lang)}</p>}
              <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${cat.description && pick(cat.description, lang) ? "" : "mt-4"}`}>
                {spots
                  .filter((s) => s.category === cat.id)
                  .map((spot) => (
                    <InfoCard
                      key={spot.id}
                      testId="campus-card"
                      boxId={spot.id}
                      href={`/campus/${spot.id}`}
                      title={pick(spot.name, lang)}
                      description={pick(spot.description, lang)}
                      images={decor[spot.id]}
                      footer={
                        spot.hours ? (
                          <span className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
                            <Clock size={12} /> {pick(spot.hours, lang)}
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
