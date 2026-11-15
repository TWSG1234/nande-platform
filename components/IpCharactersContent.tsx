"use client";

import { Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { pick } from "@/lib/i18n/pick";
import { IpCharacter } from "@/lib/types";
import IPCharacterCard from "@/components/IPCharacterCard";

export default function IpCharactersContent({ characters }: { characters: IpCharacter[] }) {
  const { t, lang } = useLanguage();

  if (characters.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-28 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-lantern-500/10 text-lantern-600 dark:text-lantern-300">
          <Sparkles size={28} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold text-ink-900 dark:text-white">{t("nav_ip_characters")}</h1>
        <p className="mt-3 text-ink-400 leading-relaxed">{t("coming_soon_body")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14">
      <h1 className="font-display text-3xl font-bold text-ink-900 dark:text-white text-center">
        {t("nav_ip_characters")}
      </h1>
      <p className="mt-2 text-center text-sm text-ink-400">
        {lang === "zh-TW" ? "點擊卡片認識每一位角色" : "Tap a card to meet each character"}
      </p>

      <div className="mt-10 flex flex-col items-center gap-10 sm:gap-14">
        {characters.map((c) => (
          <IPCharacterCard
            key={c.id}
            lang={lang}
            data={{
              id: c.id,
              name: c.name,
              image: c.image,
              positionZh: c.position["zh-TW"],
              positionEn: c.position.en,
              personalityZh: c.personality["zh-TW"],
              personalityEn: c.personality.en,
              quoteZh: c.quote["zh-TW"],
              quoteEn: c.quote.en,
              conceptTitleZh: c.conceptTitle["zh-TW"],
              conceptTitleEn: c.conceptTitle.en,
              introZh: c.intro["zh-TW"],
              introEn: c.intro.en,
              backImage: c.backImage,
              backImageWidth: c.backImageWidth,
              backImageHeight: c.backImageHeight,
              bgColor: c.bgColor,
              borderColor: c.borderColor,
              textColor: c.textColor,
              accentColor: c.accentColor,
            }}
          />
        ))}
      </div>
    </div>
  );
}
