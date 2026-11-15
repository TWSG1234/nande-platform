"use client";

/**
 * 小型對話框——點擊 IP 角色後在角色上方／旁邊冒出來。純展示用，不吃使用者
 * 輸入。max-width 避免長文字把版面撐開，文字過長會自動換行（white-space
 * normal，不會被截斷）。顏色沿用網站主色系，沒有額外加色。
 */
export default function DialogueBubble({
  text,
  className = "",
  maxWidthClass = "max-w-[min(85vw,320px)] sm:max-w-[360px]",
}: {
  text: string;
  className?: string;
  // 預設的最大寬度；角色旁邊剩餘空間比較小的時候（例如靠近右側邊緣），呼叫端可以
  // 傳入較窄的寬度上限，長文字會在上限內自動換行，不會超出畫面。
  maxWidthClass?: string;
}) {
  if (!text) return null;
  return (
    <div
      role="status"
      className={`pointer-events-none absolute z-20 w-max ${maxWidthClass} rounded-2xl bg-white dark:bg-canvas-darkcard px-4 py-2.5 text-xs sm:text-sm text-ink-900 dark:text-white shadow-soft dark:shadow-softdark border border-ink-100 dark:border-white/10 animate-fade-up ${className}`}
      style={{ whiteSpace: "normal", wordBreak: "break-word" }}
    >
      {text}
    </div>
  );
}
