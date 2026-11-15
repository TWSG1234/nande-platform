"use client";

import { useState } from "react";
import { stageName } from "@/lib/chinese/stageName";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CheckCircle2, ImageIcon, RotateCcw } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { pick } from "@/lib/i18n/pick";
import { ChineseStageDetail } from "@/lib/serverData";
import AudioPronounce from "@/components/AudioPronounce";
import { FillBlankSet, MultipleChoiceSet, TrueFalseSet, MatchingSet } from "@/components/chinese/QuestionSets";

const QUESTION_TYPES = ["fill_blank", "multiple_choice", "matching", "true_false"];

const PAGE_TYPE_LABEL: Record<string, { "zh-TW": string; en: string }> = {
  comic: { "zh-TW": "小漫畫", en: "Comic" },
  vocabulary: { "zh-TW": "單字學習", en: "Vocabulary" },
  fill_blank: { "zh-TW": "填空題挑戰", en: "Fill in the Blank" },
  multiple_choice: { "zh-TW": "選擇題", en: "Multiple Choice" },
  matching: { "zh-TW": "配對題", en: "Matching" },
  true_false: { "zh-TW": "是非題", en: "True or False" }, // 原本叫「判斷題」，已改名為「是非題」
};

export default function ChineseStageFlowContent({
  track,
  stage,
}: {
  track: "life" | "campus";
  stage: ChineseStageDetail;
}) {
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0); // 「重新練習」時換掉題目元件，作答狀態重來
  const pages = stage.pages;
  const current = pages[step];
  // 這一關有兩種以上題型時，在題目頁上方顯示題型分頁籤，使用者可以直接在
  // 填空題／選擇題／配對題／是非題之間切換；同一題型的所有題目集中在同一頁。
  const questionPageIndexes = pages.map((p, i) => (QUESTION_TYPES.includes(p.type) ? i : -1)).filter((i) => i >= 0);
  const isQuestionPage = !!current && QUESTION_TYPES.includes(current.type);

  const trackLabel = track === "life" ? t("chinese_entry_life") : t("chinese_entry_campus");
  const stageLabel = stageName(stage.title, stage.levelNumber, lang);
  const next = stage.nextStage;
  const isLast = step === pages.length - 1;

  return (
    <div
      className={`mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 ${
        current?.type === "comic" ? "max-w-5xl" : current?.type === "vocabulary" ? "max-w-6xl" : "max-w-2xl"
      }`}
    >
      <Link href={`/chinese/${track}`} className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> {trackLabel}
      </Link>
      <h1 className="mt-3 text-center font-display text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">
        {stageLabel}
      </h1>

      {done ? (
        <div data-testid="stage-complete" className="mt-10 rounded-2xl border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-transit-500" />
          <p className="mt-3 font-display text-xl font-bold text-ink-900 dark:text-white">
            {lang === "zh-TW" ? `${stageLabel} 完成！` : `${stageLabel} complete!`}
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <button
              type="button"
              data-testid="stage-retry"
              onClick={() => {
                setDone(false);
                setStep(0);
                setRunKey((k) => k + 1);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink-100 dark:border-ink-800 px-5 py-2.5 text-sm text-ink-600 dark:text-ink-100"
            >
              <RotateCcw size={15} /> {lang === "zh-TW" ? "重新練習" : "Practice again"}
            </button>
            <Link
              href={`/chinese/${track}`}
              data-testid="stage-back-list"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink-100 dark:border-ink-800 px-5 py-2.5 text-sm text-ink-600 dark:text-ink-100"
            >
              {lang === "zh-TW" ? "返回關卡列表" : "Back to levels"}
            </Link>
            {next && (
              <Link
                href={`/chinese/${track}/${next.id}`}
                data-testid="stage-next"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-transit-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-transit-600"
              >
                {lang === "zh-TW" ? "進入下一關" : "Next level"} <ArrowRight size={15} />
              </Link>
            )}
          </div>
          {next && (
            <p className="mt-3 text-xs text-ink-400" data-testid="stage-next-name">
              {stageName(next.title, next.levelNumber, lang)}
            </p>
          )}
        </div>
      ) : !current ? (
        <p className="mt-10 rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-8 text-center text-sm text-ink-400">
          {t("coming_soon_body")}
        </p>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {pages.map((p, i) => (
              <span
                key={p.id}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-transit-500" : "w-1.5 bg-ink-100 dark:bg-white/10"}`}
              />
            ))}
          </div>

          {isQuestionPage && questionPageIndexes.length >= 2 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {questionPageIndexes.map((idx) => {
                const p = pages[idx]!;
                return (
                  <button
                    key={p.id}
                    onClick={() => setStep(idx)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      idx === step
                        ? "border-transit-500 bg-transit-500/10 text-transit-700 dark:text-transit-200"
                        : "border-ink-100 dark:border-white/10 text-ink-600 dark:text-ink-100 hover:border-transit-300"
                    }`}
                  >
                    {pick(PAGE_TYPE_LABEL[p.type] ?? PAGE_TYPE_LABEL.comic!, lang)}
                  </button>
                );
              })}
            </div>
          )}

          <div className={`mt-8 rounded-2xl border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard ${current.type === "comic" ? "p-2 sm:p-4 lg:p-5" : current.type === "vocabulary" ? "p-6 sm:p-10 lg:p-12" : "p-4 sm:p-6 lg:p-8"}`}>
            <p className="text-center text-xs font-medium text-annotation">
              {current.title ? pick(current.title, lang) : pick(PAGE_TYPE_LABEL[current.type] ?? PAGE_TYPE_LABEL.comic!, lang)}
            </p>

            {current.type === "comic" && (
              <ComicPage images={current.comicImages} imagesEn={current.comicImagesEn} allowFlip={current.allowFlip} />
            )}
            {current.type === "vocabulary" && <VocabularyPage words={current.words} />}
            {current.type === "fill_blank" && <FillBlankSet key={`${runKey}-${current.id}`} questions={current.questions} lang={lang} stageId={stage.id} />}
            {current.type === "multiple_choice" && <MultipleChoiceSet key={`${runKey}-${current.id}`} questions={current.questions} lang={lang} stageId={stage.id} />}
            {current.type === "true_false" && <TrueFalseSet key={`${runKey}-${current.id}`} questions={current.questions} lang={lang} stageId={stage.id} />}
            {current.type === "matching" && <MatchingSet key={`${runKey}-${current.id}`} questions={current.questions} lang={lang} stageId={stage.id} />}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 rounded-full border border-ink-100 dark:border-ink-800 px-5 py-2.5 text-sm text-ink-600 dark:text-ink-100 disabled:opacity-30"
            >
              <ArrowLeft size={15} /> {lang === "zh-TW" ? "上一頁" : "Previous"}
            </button>
            {isLast ? (
              <button
                type="button"
                data-testid="stage-finish"
                onClick={() => setDone(true)}
                className="flex items-center gap-1.5 rounded-full bg-transit-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-transit-600"
              >
                {lang === "zh-TW" ? "完成本關" : "Finish level"} <CheckCircle2 size={15} />
              </button>
            ) : (
              <button
                type="button"
                data-testid="stage-next-page"
                onClick={() => setStep((s) => Math.min(pages.length - 1, s + 1))}
                className="flex items-center gap-1.5 rounded-full bg-transit-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-transit-600"
              >
                {lang === "zh-TW" ? "下一頁" : "Next"} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ComicPage({
  images,
  imagesEn,
  allowFlip,
}: {
  images: ChineseStageDetail["pages"][number]["comicImages"];
  imagesEn: ChineseStageDetail["pages"][number]["comicImages"];
  allowFlip: boolean;
}) {
  const { lang } = useLanguage();
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  // 只有兩種版本都有圖、而且後台允許翻轉時，才真的可以切換——只有一種版本
  // 的時候直接顯示那一種，不出現「點擊翻轉」的提示（照需求：只有單一版本
  // 時不要顯示翻轉提示）。
  const canFlip = allowFlip && images.length > 0 && imagesEn.length > 0;
  const primary = images.length > 0 ? images : imagesEn;

  if (primary.length === 0) {
    return (
      <div className="mt-6 flex aspect-[3/4] max-w-sm mx-auto flex-col items-center justify-center gap-2 rounded-xl bg-ink-50 dark:bg-white/5 text-ink-400">
        <ImageIcon size={40} strokeWidth={1.5} />
        <span className="text-xs">{lang === "zh-TW" ? "漫畫圖片待新增" : "Comic image coming soon"}</span>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {canFlip && (
        <p className="text-center text-xs text-annotation">
          {lang === "zh-TW" ? "點擊可切換中英文" : "Tap to switch between Chinese and English"}
        </p>
      )}
      {primary.map((zhImg, i) => {
        const enImg = imagesEn[i];
        // 預設顯示跟目前網站語言一致的那一版（中文模式先看中文版、英文模式先看英文版），
        // 使用者點擊就切到另一個語言版本。
        const isFlipped = canFlip && !!flipped[i] !== (lang === "en");

        function toggle() {
          if (!canFlip) return;
          setFlipped((prev) => ({ ...prev, [i]: !prev[i] }));
        }

        // 注意：旋轉的容器本身不能設 overflow-hidden——overflow 不是 visible 的元素
        // 會把 preserve-3d 壓平，翻轉就只會看到中文版的鏡像、永遠翻不到英文版。
        // 圓角與裁切要放在正反兩個面上。
        // 跟身分證卡片同一套做法：perspective + preserve-3d + 正反兩面
        // backface-visibility: hidden，用容器自己的 aspect-ratio（以中文版
        // 圖片的原始寬高為準）維持比例，正反兩面都用 object-contain，兩張
        // 圖各自的原始比例都不會被拉伸或裁切。
        return (
          <div key={i} className="mx-auto w-full max-w-4xl" style={{ perspective: "2000px" }}>
            <div
              role={canFlip ? "button" : undefined}
              tabIndex={canFlip ? 0 : undefined}
              onClick={toggle}
              onKeyDown={canFlip ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } } : undefined}
              className={`relative ${canFlip ? "cursor-pointer" : ""}`}
              style={{
                aspectRatio: zhImg.width / zhImg.height,
                transformStyle: "preserve-3d",
                transition: "transform 0.7s cubic-bezier(0.4, 0.15, 0.2, 1)",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-xl bg-ink-50 dark:bg-white/5" style={{ backfaceVisibility: "hidden" }}>
                <Image src={zhImg.url} alt="" width={zhImg.width} height={zhImg.height} className="h-full w-full object-contain" />
              </div>
              {enImg && (
                <div
                  className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl bg-ink-50 dark:bg-white/5"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <Image src={enImg.url} alt="" width={enImg.width} height={enImg.height} className="h-full w-full object-contain" />
                </div>
              )}
            </div>
            {zhImg.caption && <p className="mt-2 text-center text-sm text-ink-400">{pick(zhImg.caption, lang)}</p>}
          </div>
        );
      })}
    </div>
  );
}

function VocabularyPage({ words }: { words: ChineseStageDetail["pages"][number]["words"] }) {
  const { lang } = useLanguage();
  if (words.length === 0) {
    return <p className="mt-6 text-center text-sm text-ink-400">{lang === "zh-TW" ? "單字待新增" : "Vocabulary coming soon"}</p>;
  }
  return (
    // 手機（<640px）1 欄，稍寬的手機／平板 2 欄，桌面 3～4 欄——用固定寬度會
    // 在窄螢幕橫向溢出，所以欄數用 grid-cols 響應式切換，欄寬永遠跟著容器走。
    <div className="mt-10 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {words.map((w) => (
        <div
          key={w.id}
          className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-ink-100 dark:border-white/10 p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-display text-xl font-bold text-ink-900 dark:text-white sm:text-2xl">{w.hanzi}</p>
            <AudioPronounce text={w.hanzi} />
          </div>
          <div>
            <p className="text-sm text-ink-400">{w.pinyin}</p>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-200">{w.english}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
