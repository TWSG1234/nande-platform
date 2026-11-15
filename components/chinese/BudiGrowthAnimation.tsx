"use client";

/**
 * 校園 8 關的答對動畫——布迪從土裡逐漸長出來，每一關畫面都不一樣（不是
 * 同一張圖快速切換）：
 * 1 挖土+放種子+埋土　2 澆水+發芽　3 繼續澆水+長大　4 施肥+展葉
 * 5 曬太陽+冒出一點橘色頭頂　6 澆水+冒出更多　7 施肥+冒出大半身　8 收成+完整蹦出來
 *
 * 用單純的 SVG 形狀＋CSS 動畫做出每一關的「動作」，不是靜態插畫：水滴會
 * 落下、土會被挖開、布迪會從土裡慢慢浮出來。顏色沿用網站主色/輔色系統，
 * 布迪本身維持他自己卡片上的橘色（#df8807），不是額外加的顏色。
 */
export default function BudiGrowthAnimation({ stage }: { stage: number }) {
  const s = Math.min(8, Math.max(1, stage));
  const soilY = 150;
  // 布迪冒出土壤的高度，從第 5 關開始逐漸增加
  const budiPeek = s === 5 ? 14 : s === 6 ? 32 : s === 7 ? 58 : s === 8 ? 86 : 0;
  const plantHeight = s <= 1 ? 0 : s === 2 ? 18 : s === 3 ? 36 : s >= 4 ? 52 : 0;
  const showLeaves = s >= 4;
  const showWater = [2, 3, 6].includes(s);
  const showSun = s >= 5;
  const showFertilizer = s === 4 || s === 7;
  const showSeed = s === 1;
  const showHarvestSparkle = s === 8;

  return (
    <svg viewBox="0 0 200 200" className="h-48 w-48 sm:h-56 sm:w-56" aria-hidden>
      {showSun && (
        <circle cx="160" cy="36" r="18" fill="#FDD35F" className="animate-pulse">
          <animate attributeName="r" values="16;19;16" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {showWater && (
        <g>
          <circle cx="70" cy="40" r="4" fill="#84bed7">
            <animate attributeName="cy" values="30;100" dur="1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="95" cy="30" r="4" fill="#84bed7">
            <animate attributeName="cy" values="20;100" dur="1.1s" begin="0.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="1.1s" begin="0.2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {showFertilizer && (
        <g>
          <rect x="128" y="60" width="18" height="22" rx="2" fill="#9F4424" />
          <circle cx="137" cy="90" r="3" fill="#9F4424">
            <animate attributeName="cy" values="82;110" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="1.2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* 土壤 */}
      <rect x="20" y={soilY} width="160" height="30" rx="6" fill="#B8864F" />
      <rect x="20" y={soilY} width="160" height="8" rx="4" fill="#A9774A" />

      {showSeed && <ellipse cx="100" cy={soilY - 2} rx="6" ry="4" fill="#5B3A1E" />}

      {plantHeight > 0 && (
        <g>
          <rect x="97" y={soilY - plantHeight} width="6" height={plantHeight} rx="3" fill="#579230" />
          {showLeaves && (
            <>
              <ellipse cx="85" cy={soilY - plantHeight + 8} rx="14" ry="7" fill="#7CB342" transform={`rotate(-20 85 ${soilY - plantHeight + 8})`} />
              <ellipse cx="115" cy={soilY - plantHeight + 14} rx="14" ry="7" fill="#7CB342" transform={`rotate(20 115 ${soilY - plantHeight + 14})`} />
            </>
          )}
        </g>
      )}

      {budiPeek > 0 && (
        <g>
          <circle cx="100" cy={soilY - budiPeek} r={budiPeek * 0.95} fill="#df8807" />
          <circle cx={100 - budiPeek * 0.35} cy={soilY - budiPeek - budiPeek * 0.25} r={budiPeek * 0.14} fill="#2b1a0a" />
          <circle cx={100 + budiPeek * 0.35} cy={soilY - budiPeek - budiPeek * 0.25} r={budiPeek * 0.14} fill="#2b1a0a" />
          {s === 8 && (
            <path
              d={`M ${100 - budiPeek * 0.25} ${soilY - budiPeek + budiPeek * 0.15} Q 100 ${soilY - budiPeek + budiPeek * 0.4} ${100 + budiPeek * 0.25} ${soilY - budiPeek + budiPeek * 0.15}`}
              stroke="#2b1a0a"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </g>
      )}

      {showHarvestSparkle && (
        <g stroke="#F5CA85" strokeWidth="3" strokeLinecap="round">
          <line x1="40" y1="60" x2="48" y2="68">
            <animate attributeName="opacity" values="0;1;0" dur="1.4s" repeatCount="indefinite" />
          </line>
          <line x1="160" y1="70" x2="152" y2="78">
            <animate attributeName="opacity" values="0;1;0" dur="1.4s" begin="0.4s" repeatCount="indefinite" />
          </line>
          <line x1="150" y1="130" x2="158" y2="124">
            <animate attributeName="opacity" values="0;1;0" dur="1.4s" begin="0.8s" repeatCount="indefinite" />
          </line>
        </g>
      )}
    </svg>
  );
}
