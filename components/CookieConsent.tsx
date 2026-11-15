"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const STORAGE_KEY = "exchange-platform-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard shadow-soft dark:shadow-softdark p-5 animate-fade-up">
      <div className="flex items-start gap-3">
        <Cookie size={18} className="text-lantern-500 shrink-0 mt-0.5" />
        <p className="text-xs text-ink-400 leading-relaxed">{t("cookie_text")}</p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={accept} className="text-xs font-medium rounded-full bg-transit-500 hover:bg-transit-600 text-white px-4 py-1.5 transition-colors">
          {t("cookie_accept")}
        </button>
      </div>
    </div>
  );
}
