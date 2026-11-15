"use client";

import { X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * 答對動畫的獨立彈窗——不是直接畫在題目下面，是跳出一個 Modal（參考台灣
 * 行事曆點日期跳出的詳細資訊視窗的做法：半透明遮罩＋置中卡片）。裡面要
 * 放什麼動畫完全由呼叫端透過 children 決定，這個元件只負責「彈窗殼」，
 * 方便以後動畫內容隨時替換，不用動到這個殼本身。
 */
export default function SuccessAnimationModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-card dark:bg-canvas-darkcard p-6 shadow-soft dark:shadow-softdark sm:max-w-md"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 dark:bg-white/10 text-ink-400 transition hover:text-ink-900 dark:hover:text-white"
        >
          <X size={16} />
        </button>

        <p className="text-center font-display text-lg font-bold text-transit-600 dark:text-transit-300">
          {t("answer_success_title")}
        </p>

        <div className="mt-4 flex items-center justify-center">{children}</div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-transit-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-transit-600"
        >
          {t("close_label")}
        </button>
      </div>
    </div>
  );
}
