"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CommentSection from "@/components/CommentSection";
import { useLanguage } from "@/context/LanguageContext";
import { pick } from "@/lib/i18n/pick";
import { Localized } from "@/lib/types";

type Photo = {
  id: string;
  imageUrl: string | null;
  title: Localized;
  caption: Localized | null;
  createdAt: string;
};

type Comment = { id: string; nickname: string; content: string; createdAt: string };

export default function PhotoDetailContent({ photo, comments }: { photo: Photo; comments: Comment[] }) {
  const { t, lang } = useLanguage();

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
      <Link href="/photo-submit" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {t("photo_back_to_wall")}
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl2 bg-ink-50 dark:bg-white/5">
        {photo.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.imageUrl} alt={pick(photo.title, lang)} className="w-full object-cover" />
        )}
      </div>

      <h1 className="mt-5 font-display text-2xl font-bold text-ink-900 dark:text-white">{pick(photo.title, lang)}</h1>
      {photo.caption && (
        <p className="mt-2 text-ink-600 dark:text-ink-100 leading-relaxed">{pick(photo.caption, lang)}</p>
      )}
      <p className="mt-2 text-xs text-ink-400">
        {t("photo_submitted_at")}：{new Date(photo.createdAt).toLocaleString(lang === "zh-TW" ? "zh-TW" : "en-US")}
      </p>

      <CommentSection photoId={photo.id} initialComments={comments} />
    </div>
  );
}
