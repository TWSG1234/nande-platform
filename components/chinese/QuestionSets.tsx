"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { pick } from "@/lib/i18n/pick";
import { ChineseStageDetail } from "@/lib/serverData";
import AudioPronounce from "@/components/AudioPronounce";
import AnswerFeedback from "@/components/chinese/AnswerFeedback";
import { CorrectAnimationConfig } from "@/components/chinese/CustomCorrectAnimation";
import CorrectAnimationModal from "@/components/chinese/CorrectAnimationModal";

type Q = ChineseStageDetail["pages"][number]["questions"][number];
type Lang = "zh-TW" | "en";

/**
 * 每一關有自己獨立的「答題成功動畫」（後台：中文學習 → 該關編輯頁），以關卡 ID（stageId）關聯。
 * 全部答對（判定結果全對）之後才跳出「答題成功彈窗」：
 *   這一關有動畫 → 彈窗內播放 MP4／GIF／SVG，播完停在最後一幀，彈窗不會自動消失；
 *   沒設定、讀不到、載入失敗 → 同一個彈窗，只顯示文字＋圖示。永遠不會用到其他關卡的動畫。
 * 彈窗的「重新觀看」只重設播放狀態，不會重新判定答案或重複執行任何答題邏輯。
 */
type AnimState = { loaded: boolean; config: CorrectAnimationConfig };

function useStageAnimation(stageId: string) {
  const [anim, setAnim] = useState<AnimState>({ loaded: false, config: { mode: "none" } });

  useEffect(() => {
    let alive = true;
    setAnim({ loaded: false, config: { mode: "none" } }); // 切換關卡：先清掉，不沿用前一關
    const done = (config: CorrectAnimationConfig) => alive && setAnim({ loaded: true, config });
    // 網路／伺服器暫時失敗（例如剛重新啟動、第一次編譯路由）不能當成「這一關沒有動畫」：最多重試 3 次。
    // 伺服器明確回答「沒有動畫」（200 + mode: none）或這一關的設定不合格才算沒有。
    const delays = [0, 700, 1800];
    const attempt = (i: number): void => {
      if (!alive) return;
      fetch(`/api/chinese/correct-animation?stageId=${encodeURIComponent(stageId)}`, { cache: "no-store" })
        .then((r) => {
          if (r.ok) return r.json();
          if (r.status >= 500 && i + 1 < delays.length) throw new Error("retry");
          return null;
        })
        .then((j) => {
          if (j && j.mode === "custom" && ["mp4", "gif", "svg"].includes(j.format) && typeof j.src === "string")
            done({ mode: "custom", format: j.format, src: j.src, svgMs: typeof j.svgMs === "number" ? j.svgMs : 0 });
          else done({ mode: "none" });
        })
        .catch(() => {
          if (i + 1 < delays.length) setTimeout(() => attempt(i + 1), delays[i + 1]);
          else done({ mode: "none" });
        });
    };
    attempt(0);
    return () => {
      alive = false;
    };
  }, [stageId]);

  return anim;
}

/**
 * 同一題型的所有題目一次放在同一頁，全部作答完才按一次「提交答案」統一判定
 * （不是一題一頁、也不是答一題判一題）。全部答對 → 跳出答題成功彈窗；有答錯 →
 * 只標示「哪幾題再試一次」，不顯示正確答案，使用者改答案後可以重新提交。
 * 彈窗只在「判定結果全對」之後開啟；彈窗開著時 submit 不會再執行；
 * 「重新觀看」只改 playId，不碰 results／判定。
 */
function useSubmission(stageId: string, questions: Q[], judge: (q: Q) => boolean, lang: Lang) {
  const [results, setResults] = useState<Record<string, boolean> | null>(null);
  const anim = useStageAnimation(stageId);
  const [open, setOpen] = useState(false);
  const [playId, setPlayId] = useState(0); // 每次「答題成功」或「重新觀看」+1；0＝尚未播放

  useEffect(() => {
    setOpen(false);
    setPlayId(0);
  }, [stageId]);

  function submit() {
    if (open) return; // 彈窗開著時不重複判定、不重複觸發
    const r: Record<string, boolean> = {};
    for (const q of questions) r[q.id] = judge(q);
    setResults(r);
    if (Object.values(r).every(Boolean)) {
      setPlayId((n) => n + 1); // 本次成功回饋的獨立播放狀態
      setOpen(true);
    }
  }
  const allCorrect = !!results && Object.values(results).every(Boolean);
  const modal = (
    <CorrectAnimationModal
      open={open}
      loading={!anim.loaded}
      config={anim.config}
      playId={playId}
      lang={lang}
      onReplay={() => setPlayId((n) => n + 1)}
      onContinue={() => setOpen(false)}
    />
  );
  // 關掉彈窗之後，頁面上的「再看一次動畫」可以重新開啟（同樣只改播放狀態）
  const reopen = () => {
    setPlayId((n) => n + 1);
    setOpen(true);
  };
  return { results, submit, reset: () => setResults(null), allCorrect, inline: modal, canReplay: anim.config.mode === "custom", replay: reopen };
}

function EmptySet({ lang }: { lang: Lang }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-8 text-center text-sm text-ink-400">
      {lang === "zh-TW" ? "題目準備中，敬請期待！" : "Questions are on their way — check back soon!"}
    </div>
  );
}

/**
 * 題目文字只顯示「後台實際設定」的欄位，不自行複製、翻譯或拼接：
 *  - 英文列：後台有填英文題目（且和中文不是同一段文字）才顯示。
 *  - 中文列：由呼叫端決定要顯示哪一種中文——填空題／配對題傳入「挖空後」的句子；
 *    zh 傳 null 代表這一題型不在題目區顯示中文（配對題的中文挖空句由下方的放置框顯示，完整中文句不顯示）。
 *  - 只剩一列時不加「English／中文」標籤（避免看起來像重複兩排）。
 */
export function promptRows(q: Q, zh: string | null | undefined): { en: string | null; zh: string | null } {
  const zhFull = (q.prompt["zh-TW"] || "").trim();
  const en = (q.prompt.en || "").trim();
  return {
    en: en && en !== zhFull ? en : null,
    zh: zh === null ? null : ((zh ?? zhFull).trim() ? (zh ?? zhFull) : null),
  };
}

function QuestionPrompt({ q, lang, index, zh }: { q: Q; lang: Lang; index: number; zh?: string | null }) {
  const rows = promptRows(q, zh);
  const both = !!rows.en && !!rows.zh;
  return (
    <div data-testid="question-prompt">
      <p className="text-xs font-semibold text-annotation">{index + 1}.</p>
      {rows.en && (
        <>
          {both && <p className="mt-1 text-sm text-ink-400">English</p>}
          <p data-testid="prompt-en" className="mt-1 text-base text-ink-900 dark:text-white">{rows.en}</p>
        </>
      )}
      {rows.zh && (
        <>
          {both && <p className="mt-3 text-sm text-ink-400">{lang === "zh-TW" ? "中文" : "Chinese"}</p>}
          <p data-testid="prompt-zh" className="mt-1 font-display text-lg font-bold tracking-wide text-ink-900 dark:text-white">
            {rows.zh}
          </p>
        </>
      )}
    </div>
  );
}

function QuestionStatus({ result, lang }: { result: boolean | undefined; lang: Lang }) {
  if (result === undefined) return null;
  return result ? (
    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-transit-600 dark:text-transit-300">
      <CheckCircle2 size={14} /> {lang === "zh-TW" ? "正確" : "Correct"}
    </p>
  ) : (
    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-500 dark:text-ink-200">
      <RotateCcw size={14} /> {lang === "zh-TW" ? "再試一次" : "Try again"}
    </p>
  );
}

function SubmitArea({
  lang,
  ready,
  results,
  allCorrect,
  onSubmit,
  onReplay,
  inline,
  canReplay = true,
}: {
  lang: Lang;
  ready: boolean;
  results: Record<string, boolean> | null;
  allCorrect: boolean;
  onSubmit: () => void;
  onReplay: () => void;
  inline?: React.ReactNode;
  canReplay?: boolean;
}) {
  return (
    <div className="mt-6">
      <button
        onClick={onSubmit}
        disabled={!ready || allCorrect}
        className="w-full rounded-lg bg-transit-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-transit-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {lang === "zh-TW" ? "提交答案" : "Submit answers"}
      </button>
      {!ready && (
        <p className="mt-2 text-xs text-ink-400">
          {lang === "zh-TW" ? "全部題目都作答後才能提交。" : "Answer every question to submit."}
        </p>
      )}
      {results && <AnswerFeedback state={allCorrect ? "correct" : "incorrect"} lang={lang} />}
      {inline}
      {allCorrect && canReplay && (
        <button onClick={onReplay} className="mt-2 text-xs font-medium text-annotation underline">
          {lang === "zh-TW" ? "再看一次動畫" : "Watch the animation again"}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── 填空題 ───────────────────────── */

type FillBlankAnswerData = { blank: string; acceptableAnswers?: string[] };

function parseFillBlankAnswer(raw: string): FillBlankAnswerData {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.blank === "string") return parsed;
  } catch {
    // 舊資料或還沒填好格式的時候，退回「整段 answerData 字串就是答案」
  }
  return { blank: raw.trim() };
}

/** 把「我今天感冒了。」+ 答案「感冒」→「我今天____了。」，只替換第一次出現的位置。 */
function blankOutSentence(sentence: string, blank: string): string {
  if (!blank) return sentence;
  const idx = sentence.indexOf(blank);
  if (idx === -1) return sentence;
  return sentence.slice(0, idx) + "____" + sentence.slice(idx + blank.length);
}

function checkFillBlank(input: string, data: FillBlankAnswerData): boolean {
  const given = input.trim();
  if (!given) return false;
  return [data.blank, ...(data.acceptableAnswers || [])].map((s) => s.trim()).filter(Boolean).includes(given);
}

export function FillBlankSet({ questions, lang, stageId }: { questions: Q[]; lang: Lang; stageId: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const parsed = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, parseFillBlankAnswer(q.answerData)])), [questions]);
  const sub = useSubmission(stageId, questions, (q) => checkFillBlank(answers[q.id] ?? "", parsed[q.id]!), lang);

  if (questions.length === 0) return <EmptySet lang={lang} />;
  const ready = questions.every((q) => (answers[q.id] ?? "").trim());

  return (
    <div className="mt-6 space-y-5">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-ink-100 dark:border-white/10 p-5">
          <QuestionPrompt q={q} lang={lang} index={i} zh={blankOutSentence(q.prompt["zh-TW"], parsed[q.id]!.blank)} />
          {q.hint && <p className="mt-3 text-xs text-ink-400">💡 {pick(q.hint, lang)}</p>}
          <input
            value={answers[q.id] ?? ""}
            onChange={(e) => {
              setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
              sub.reset();
            }}
            placeholder={lang === "zh-TW" ? "請輸入答案" : "Type your answer"}
            className="mt-4 w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2.5 text-base outline-none focus:border-transit-500"
          />
          <QuestionStatus result={sub.results?.[q.id]} lang={lang} />
        </div>
      ))}
      <SubmitArea lang={lang} ready={ready} results={sub.results} allCorrect={sub.allCorrect} onSubmit={sub.submit} onReplay={sub.replay} inline={sub.inline} canReplay={sub.canReplay} />
    </div>
  );
}

/* ───────────────────────── 選擇題 ───────────────────────── */

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

type MultipleChoiceAnswerData = { options: string[]; correctAnswer: string };

function parseMultipleChoiceAnswer(raw: string): MultipleChoiceAnswerData {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.options) && typeof parsed.correctAnswer === "string") return parsed;
  } catch {
    // 忽略，退回空選項
  }
  return { options: [], correctAnswer: "" };
}

/** Fisher-Yates，只在進入這一頁時跑一次（見呼叫端 useMemo）。 */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function MultipleChoiceSet({ questions, lang, stageId }: { questions: Q[]; lang: Lang; stageId: string }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const parsed = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, parseMultipleChoiceAnswer(q.answerData)])), [questions]);
  // 進到這一頁隨機排一次，同一次作答期間選項位置不會跑掉；A/B/C/D 標號固定對應
  // 「洗牌後的第幾個位置」，正確答案用內容比對，不依賴位置。
  const shuffled = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, shuffle(parseMultipleChoiceAnswer(q.answerData).options)])),
    [questions]
  );
  const sub = useSubmission(stageId, questions, (q) => selected[q.id] === parsed[q.id]!.correctAnswer, lang);

  if (questions.length === 0) return <EmptySet lang={lang} />;
  const ready = questions.every((q) => selected[q.id] !== undefined);

  return (
    <div className="mt-6 space-y-5">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-ink-100 dark:border-white/10 p-5">
          <QuestionPrompt q={q} lang={lang} index={i} />
          <div className="mt-4 space-y-2">
            {(shuffled[q.id] ?? []).map((option, idx) => {
              const isSelected = selected[q.id] === option;
              return (
                <button
                  key={option}
                  onClick={() => {
                    setSelected((prev) => ({ ...prev, [q.id]: option }));
                    sub.reset();
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition ${
                    isSelected
                      ? "border-transit-500 bg-transit-500/10 text-transit-700 dark:text-transit-200"
                      : "border-ink-100 dark:border-white/10 hover:border-transit-300"
                  }`}
                >
                  <span className="font-display text-sm font-bold text-annotation">({OPTION_LABELS[idx]})</span>
                  {option}
                </button>
              );
            })}
          </div>
          <QuestionStatus result={sub.results?.[q.id]} lang={lang} />
        </div>
      ))}
      <SubmitArea lang={lang} ready={ready} results={sub.results} allCorrect={sub.allCorrect} onSubmit={sub.submit} onReplay={sub.replay} inline={sub.inline} canReplay={sub.canReplay} />
    </div>
  );
}

/* ───────────────────────── 是非題 ───────────────────────── */

function parseTrueFalseAnswer(raw: string): "o" | "x" {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.correctAnswer === "o" || parsed.correctAnswer === "x")) return parsed.correctAnswer;
  } catch {
    // 忽略，退回預設
  }
  return "o";
}

export function TrueFalseSet({ questions, lang, stageId }: { questions: Q[]; lang: Lang; stageId: string }) {
  const [choices, setChoices] = useState<Record<string, "o" | "x">>({});
  const sub = useSubmission(stageId, questions, (q) => choices[q.id] === parseTrueFalseAnswer(q.answerData), lang);

  if (questions.length === 0) return <EmptySet lang={lang} />;
  const ready = questions.every((q) => choices[q.id] !== undefined);

  return (
    <div className="mt-6 space-y-5">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-ink-100 dark:border-white/10 p-5">
          <QuestionPrompt q={q} lang={lang} index={i} />
          <div className="mt-4 flex justify-center gap-5">
            {(["o", "x"] as const).map((choice) => (
              <button
                key={choice}
                onClick={() => {
                  setChoices((prev) => ({ ...prev, [q.id]: choice }));
                  sub.reset();
                }}
                className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-bold transition sm:h-20 sm:w-20 ${
                  choices[q.id] === choice
                    ? "border-transit-500 bg-transit-500/10 text-transit-600 dark:text-transit-300"
                    : "border-ink-200 dark:border-white/20 text-ink-600 dark:text-ink-100 hover:border-transit-300"
                }`}
              >
                {choice === "o" ? "○" : "×"}
              </button>
            ))}
          </div>
          <QuestionStatus result={sub.results?.[q.id]} lang={lang} />
        </div>
      ))}
      <SubmitArea lang={lang} ready={ready} results={sub.results} allCorrect={sub.allCorrect} onSubmit={sub.submit} onReplay={sub.replay} inline={sub.inline} canReplay={sub.canReplay} />
    </div>
  );
}

/* ───────────────────────── 配對題 ───────────────────────── */

type MatchingAnswerData = { blank: string; options: string[] };

function parseMatchingAnswer(raw: string): MatchingAnswerData {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.blank === "string" && Array.isArray(parsed.options)) return parsed;
  } catch {
    // 忽略，退回空選項
  }
  return { blank: "", options: [] };
}

/**
 * 配對題——選項放進空格後「不會立即判定」，要把整頁所有空格都放好、按「提交答案」
 * 才一次判定。桌面可以用滑鼠拖曳選項到空格；手機（或不想拖曳）直接點選項就會
 * 放進它那一題的空格。兩種操作都呼叫同一個 place()，行為完全一致。
 */
export function MatchingSet({ questions, lang, stageId }: { questions: Q[]; lang: Lang; stageId: string }) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const parsed = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, parseMatchingAnswer(q.answerData)])), [questions]);
  const shuffled = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, shuffle(parseMatchingAnswer(q.answerData).options)])),
    [questions]
  );
  const sub = useSubmission(stageId, questions, (q) => placed[q.id] === parsed[q.id]!.blank, lang);

  if (questions.length === 0) return <EmptySet lang={lang} />;
  const ready = questions.every((q) => placed[q.id] !== undefined);

  function place(qid: string, option: string) {
    setPlaced((prev) => ({ ...prev, [qid]: option }));
    sub.reset();
  }

  return (
    <div className="mt-6 space-y-5">
      {questions.map((q, i) => {
        const data = parsed[q.id]!;
        const filled = placed[q.id];
        const zh = filled ? q.prompt["zh-TW"].replace(data.blank, filled) : blankOutSentence(q.prompt["zh-TW"], data.blank);
        return (
          <div key={q.id} className="rounded-xl border border-ink-100 dark:border-white/10 p-5">
            <QuestionPrompt q={q} lang={lang} index={i} zh={null} />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.getData("text/plain");
                if (dropped) place(q.id, dropped);
              }}
              className="mt-3 min-h-[2.75rem] rounded-lg border-2 border-dashed border-ink-200 dark:border-white/20 px-3 py-2 font-display text-xl font-bold tracking-wide text-ink-900 dark:text-white"
            >
              {zh}
            </div>
            <p className="mt-3 text-xs text-ink-400">
              {lang === "zh-TW" ? "點擊或拖曳選項到上方空格" : "Tap or drag an option into the blank above"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {(shuffled[q.id] ?? []).map((option) => (
                <div
                  key={option}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", option)}
                  onClick={() => place(q.id, option)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      place(q.id, option);
                    }
                  }}
                  className={`flex cursor-grab items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition active:cursor-grabbing ${
                    filled === option
                      ? "border-transit-500 bg-transit-500/10 text-transit-700 dark:text-transit-200"
                      : "border-ink-100 dark:border-white/10 hover:border-transit-300"
                  }`}
                >
                  {option}
                  <span onClick={(e) => e.stopPropagation()}>
                    <AudioPronounce text={option} />
                  </span>
                </div>
              ))}
            </div>
            <QuestionStatus result={sub.results?.[q.id]} lang={lang} />
          </div>
        );
      })}
      <SubmitArea lang={lang} ready={ready} results={sub.results} allCorrect={sub.allCorrect} onSubmit={sub.submit} onReplay={sub.replay} inline={sub.inline} canReplay={sub.canReplay} />
    </div>
  );
}
