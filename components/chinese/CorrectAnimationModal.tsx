"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, RotateCcw, X } from "lucide-react";
import CustomCorrectAnimation, { CorrectAnimationConfig, MediaState } from "@/components/chinese/CustomCorrectAnimation";

/**
 * 「答題成功彈窗」：答案確實判定全對之後才會 open。
 * - 置中、半透明遮罩蓋住整個頁面（遮罩會攔截點擊，底下的題目／選項／提交按鈕碰不到）。
 * - 這一關有動畫 → 在彈窗內放大播放，播完停在最後一幀，彈窗保持開啟，直到使用者按「繼續學習」或關閉。
 * - 沒設定動畫、載入失敗、格式不支援 → 同一個彈窗，內容改成文字＋圖示。
 * - 「重新觀看」只呼叫 onReplay（只改播放狀態）；這個元件完全不接觸答題判定與記錄。
 */
export default function CorrectAnimationModal({
  open,
  loading,
  config,
  playId,
  lang,
  onReplay,
  onContinue,
}: {
  open: boolean;
  loading: boolean;
  config: CorrectAnimationConfig;
  playId: number;
  lang: "zh-TW" | "en";
  onReplay: () => void;
  onContinue: () => void;
}) {
  const [media, setMedia] = useState<MediaState>("loading");
  const panelRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const zh = lang === "zh-TW";

  // 開啟時：鎖住背景捲動、焦點移進彈窗、Esc 關閉、Tab 只在彈窗內循環；關閉後還原
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    continueRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onContinue();
      } else if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) setMedia("loading");
  }, [open, config.mode === "custom" ? config.src : ""]);

  if (!open || typeof document === "undefined") return null;

  const custom = config.mode === "custom";
  const showMedia = custom && media !== "failed";
  const canReplay = showMedia && !loading;

  return createPortal(
    <div
      data-testid="correct-modal"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correct-modal-title"
    >
      <div
        ref={panelRef}
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-card p-5 shadow-soft dark:bg-canvas-darkcard dark:shadow-softdark sm:max-w-lg sm:p-6"
      >
        <button
          type="button"
          data-testid="modal-close"
          onClick={onContinue}
          aria-label={zh ? "關閉" : "Close"}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition hover:text-ink-900 dark:bg-white/10 dark:hover:text-white"
        >
          <X size={16} />
        </button>

        <p id="correct-modal-title" className="pr-8 text-center font-display text-xl font-bold text-transit-600 dark:text-transit-300">
          {zh ? "答對了！" : "Correct!"}
        </p>

        <div className="mt-4 flex h-[min(50vh,22rem)] w-full items-center justify-center">
          {loading ? (
            <div data-testid="correct-loading" className="h-16 w-16 animate-pulse rounded-full bg-transit-500/20" />
          ) : showMedia ? (
            <CustomCorrectAnimation config={config as Extract<CorrectAnimationConfig, { mode: "custom" }>} playId={playId} onState={setMedia} />
          ) : (
            <div data-testid="correct-fallback" className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 size={72} className="text-transit-500" />
              <p className="text-base font-semibold text-transit-700 dark:text-transit-200">{zh ? "回答正確！" : "Correct!"}</p>
              <p className="text-sm text-transit-600 dark:text-transit-300">{zh ? "做得很好！" : "Great job!"}</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {canReplay && (
            <button
              type="button"
              data-testid="modal-replay"
              onClick={onReplay}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium transition hover:border-transit-400 dark:border-ink-800"
            >
              <RotateCcw size={15} /> {zh ? "重新觀看" : "Watch again"}
            </button>
          )}
          <button
            ref={continueRef}
            type="button"
            data-testid="modal-continue"
            onClick={onContinue}
            className="rounded-lg bg-transit-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-transit-600"
          >
            {zh ? "繼續學習" : "Keep learning"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
