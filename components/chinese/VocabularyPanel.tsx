import { VocabularyItem } from "@/lib/types";
import AudioPronounce from "@/components/AudioPronounce";
import { useLanguage } from "@/context/LanguageContext";

export default function VocabularyPanel({ vocabulary }: { vocabulary: VocabularyItem[] }) {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-transit-600 dark:text-transit-300">
        {t("chinese_vocabulary_title")}
      </h2>
      <ul className="mt-3 space-y-3">
        {vocabulary.map((item, i) => (
          <li
            key={i}
            className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-lg font-bold text-ink-900 dark:text-white leading-snug break-words">
                {item.chinese}
              </p>
              <AudioPronounce text={item.chinese} />
            </div>
            <p className="font-mono text-sm text-lantern-600 dark:text-lantern-300 mt-0.5 break-words">
              {item.pinyin}
            </p>
            <p className="text-xs text-ink-400 mt-0.5 break-words">{item.english}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
