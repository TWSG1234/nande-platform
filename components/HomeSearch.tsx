"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, MapPinned, Route } from "lucide-react";
import { searchContent } from "@/lib/search";
import { pick } from "@/lib/i18n/pick";
import { useLanguage } from "@/context/LanguageContext";

export default function HomeSearch() {
  const { lang, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchContent(query), [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const showDropdown = focused && query.trim().length > 0;

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <div className="relative">
        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          type="text"
          placeholder={t("search_placeholder")}
          className="w-full rounded-full border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard pl-11 pr-4 py-3.5 text-sm shadow-soft dark:shadow-softdark outline-none focus:ring-2 focus:ring-transit-500/40"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard shadow-soft dark:shadow-softdark overflow-hidden z-30 max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400 text-center">{t("search_no_results")}</p>
          ) : (
            <ul>
              {results.map((r) => {
                const Icon = r.type === "campus" ? MapPinned : Route;
                return (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      onClick={() => setFocused(false)}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-transit-500/10 text-transit-600 dark:text-transit-300 mt-0.5">
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-ink-900 dark:text-white truncate">{pick(r.title, lang)}</p>
                          <span className="shrink-0 text-[10px] font-medium text-ink-400 bg-ink-50 dark:bg-white/5 px-1.5 py-0.5 rounded-full">
                            {r.type === "campus" ? t("search_campus_tag") : t("search_life_tag")}
                          </span>
                        </div>
                        <p className="text-xs text-ink-400 mt-0.5 line-clamp-1">{pick(r.snippet, lang)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
