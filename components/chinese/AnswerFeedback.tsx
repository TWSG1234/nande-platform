"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";

export type AnswerState = "idle" | "correct" | "incorrect";

/**
 * 答題回饋——填空題、選擇題共用，之後配對題/判斷題也可以直接用這個元件。
 * 只負責「顯示對/錯提示＋在答對時播放動畫」，不管題目本身是什麼形式。
 *
 * 顏色刻意不用額外的紅/橘/綠——答對用主色系（transit），答錯用邊框+圖示
 * 區分，不新增網站配色系統以外的顏色。
 */
export default function AnswerFeedback({ state, lang }: { state: AnswerState; lang: "zh-TW" | "en" }) {
  if (state === "idle") return null;

  if (state === "correct") {
    return (
      <div className="mt-3 rounded-xl border border-transit-300 dark:border-transit-500/40 bg-transit-500/10 p-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-transit-700 dark:text-transit-200">
          <CheckCircle2 size={16} />
          {lang === "zh-TW" ? "回答正確！" : "Correct!"}
        </p>
        <p className="mt-0.5 text-xs text-transit-600 dark:text-transit-300">
          {lang === "zh-TW" ? "做得很好！" : "Great job!"}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink-200 dark:border-white/15 bg-ink-50 dark:bg-white/5 p-3">
      <RotateCcw size={15} className="shrink-0 text-ink-400" />
      <p className="text-sm text-ink-600 dark:text-ink-100">
        {lang === "zh-TW" ? "答案不太對，再想想看！" : "Not quite — give it another try!"}
      </p>
    </div>
  );
}
