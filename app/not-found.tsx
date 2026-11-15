"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-xl px-4 py-28 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-transit-500/10 text-transit-600 dark:text-transit-300">
        <Compass size={28} />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold text-ink-900 dark:text-white">{t("notfound_title")}</h1>
      <p className="mt-3 text-ink-400 leading-relaxed">{t("notfound_body")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-transit-500 hover:bg-transit-600 text-white text-sm font-medium px-6 py-3 transition-colors"
      >
        {t("notfound_cta")}
      </Link>
    </div>
  );
}
