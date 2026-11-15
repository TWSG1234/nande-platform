"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LangCode } from "@/lib/types";
import { DictKey, translate } from "@/lib/i18n/dictionary";

interface LanguageContextValue {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: DictKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const STORAGE_KEY = "exchange-platform-lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("zh-TW");

  useEffect(() => {
    let stored: LangCode | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) as LangCode | null;
    } catch {
      /* 隱私模式等情況讀不到就用預設語言 */
    }
    if (stored === "zh-TW" || stored === "en") {
      setLangState(stored);
      document.documentElement.lang = stored;
    }
  }, []);

  const setLang = useCallback((next: LangCode) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 儲存失敗不影響當次切換 */
    }
    document.documentElement.lang = next;
  }, []);

  const t = useCallback((key: DictKey) => translate(lang, key), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
