"use client";

import clsx from "clsx";
import { languages } from "@/lib/i18n/languages";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className="flex items-center rounded-full border border-ink-100 dark:border-white/10 p-0.5 text-sm"
    >
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={clsx(
            "px-3 py-1 rounded-full font-medium transition-colors",
            lang === l.code
              ? "bg-transit-500 text-white"
              : "text-ink-400 hover:text-ink-700 dark:hover:text-ink-100"
          )}
        >
          {l.shortLabel}
        </button>
      ))}
    </div>
  );
}
