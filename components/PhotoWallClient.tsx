"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MessageCircle, Camera } from "lucide-react";
import PhotoSubmitModal from "@/components/PhotoSubmitModal";
import { useLanguage } from "@/context/LanguageContext";
import { pick } from "@/lib/i18n/pick";
import { Localized } from "@/lib/types";

export type PublicPhoto = {
  id: string;
  imageUrl: string | null;
  title: Localized;
  caption: Localized | null;
  createdAt: string;
  commentCount: number;
};

export default function PhotoWallClient({ photos }: { photos: PublicPhoto[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { t, lang } = useLanguage();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-ink-900 dark:text-white">{t("nav_photo_submit")}</h1>
        <p className="mt-2 text-ink-400">{t("photo_wall_subtitle")}</p>
        <button
          onClick={() => setModalOpen(true)}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-transit-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-transit-600"
        >
          <Plus size={16} />
          {t("photo_wall_submit_button")}
        </button>
      </div>

      <div className="mt-10">
        {photos.length === 0 ? (
          <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-ink-100 dark:border-ink-800 p-10 text-center">
            <Camera size={28} className="mx-auto text-ink-400" />
            <p className="mt-3 text-sm text-ink-400">{t("photo_wall_empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <Link
                key={p.id}
                href={`/photo-submit/${p.id}`}
                className="group overflow-hidden rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard transition hover:shadow-soft dark:hover:shadow-softdark"
              >
                <div className="aspect-square w-full overflow-hidden bg-ink-50 dark:bg-white/5">
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={pick(p.title, lang)}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-white">{pick(p.title, lang)}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-400">
                    <span>{new Date(p.createdAt).toLocaleDateString(lang === "zh-TW" ? "zh-TW" : "en-US")}</span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} />
                      {p.commentCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {modalOpen && <PhotoSubmitModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
