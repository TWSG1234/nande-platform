import { DialogueLine } from "@/lib/types";
import AudioPronounce from "@/components/AudioPronounce";
import { useLanguage } from "@/context/LanguageContext";

export default function SentencePanel({ sentences }: { sentences: DialogueLine[] }) {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-lantern-600 dark:text-lantern-300">
        {t("chinese_sentences_title")}
      </h2>
      <ul className="mt-3 space-y-3">
        {sentences.map((line, i) => (
          <li
            key={i}
            className="rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm leading-relaxed break-words">
                <span className="font-semibold text-transit-600 dark:text-transit-300">{line.speaker}：</span>
                <span className="text-ink-900 dark:text-white">{line.chinese}</span>
              </p>
              <AudioPronounce text={line.chinese} />
            </div>
            <p className="font-mono text-xs text-lantern-600 dark:text-lantern-300 mt-1 break-words">
              {line.pinyin}
            </p>
            <p className="text-xs text-ink-400 mt-1 leading-relaxed break-words">{line.english}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
