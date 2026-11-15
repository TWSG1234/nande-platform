"use client";

/**
 * 回答正確時播放的小動畫，目前是「測試動畫」：澆水器倒水 → 土壤長出新芽。
 * 之後有正式動畫時，只需要替換這個元件的內容（或整個換掉這個檔案），
 * 不會動到 AnswerFeedback 或任何題型元件——它們只知道「播放一個正確動畫」，
 * 不知道動畫實際長什麼樣子。
 *
 * 純 CSS/SVG 實作，不依賴額外套件，顏色沿用網站既有的主色/輔助色系統。
 */
export default function CorrectAnswerAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-2" aria-hidden="true">
      <svg width="120" height="100" viewBox="0 0 120 100" className="overflow-visible">
        {/* 土壤 */}
        <ellipse cx="60" cy="80" rx="42" ry="10" className="fill-ink-800 dark:fill-white/20" />

        {/* 新芽：從土壤裡長出來，用 CSS keyframe 從 scaleY(0) 長到 scaleY(1) */}
        <g style={{ transformOrigin: "60px 80px", animation: "sprout-grow 0.9s 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          <line x1="60" y1="80" x2="60" y2="55" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-lantern-600 dark:text-lantern-300" />
          <path d="M60 58 C 48 54, 44 44, 50 36 C 58 42, 60 50, 60 58 Z" className="fill-lantern-500" />
          <path d="M60 58 C 72 54, 76 44, 70 36 C 62 42, 60 50, 60 58 Z" className="fill-lantern-600" />
        </g>

        {/* 澆水器：先傾倒一下再回正 */}
        <g style={{ transformOrigin: "30px 30px", animation: "watering-can-pour 0.6s ease-in-out both" }}>
          <rect x="10" y="22" width="26" height="16" rx="4" className="fill-transit-500" />
          <path d="M36 26 L50 18 L50 24 L40 30 Z" className="fill-transit-500" />
          <circle cx="50" cy="21" r="2.5" className="fill-transit-600" />
        </g>

        {/* 水滴：澆水器倒出之後落下 */}
        <g style={{ animation: "water-drop-fall 0.6s 0.15s ease-in both", opacity: 0 }}>
          <circle cx="47" cy="30" r="2" className="fill-transit-400" />
          <circle cx="52" cy="34" r="1.5" className="fill-transit-400" />
          <circle cx="44" cy="36" r="1.5" className="fill-transit-400" />
        </g>
      </svg>

      <style>{`
        @keyframes sprout-grow {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes watering-can-pour {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(-25deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes water-drop-fall {
          0% { opacity: 0; transform: translateY(-4px); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateY(14px); }
        }
        @media (prefers-reduced-motion: reduce) {
          svg * { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
