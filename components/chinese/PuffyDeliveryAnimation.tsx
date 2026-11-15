"use client";

/**
 * 生活 8 關的答對動畫——從一個空杯子到珍珠奶茶送到帕菲手裡，每一關都不同：
 * 1 空杯+加紅茶　2 加牛奶　3 加珍珠　4 蓋杯蓋　5 放進外送箱
 * 6 外送員騎車前進　7 遇紅燈→轉綠燈→繼續前進　8 送到帕菲手裡
 */
export default function PuffyDeliveryAnimation({ stage }: { stage: number }) {
  const s = Math.min(8, Math.max(1, stage));
  const teaLevel = s === 1 ? 50 : s >= 2 ? 20 : 90; // 杯子裡液面高度（y 座標，越小越滿）
  const showMilkSwirl = s === 2;
  const showPearls = s >= 3;
  const showLid = s >= 4;
  const inBox = s >= 5;
  const riding = s === 6 || s === 7;
  const atRedLight = s === 7;
  const delivered = s === 8;

  return (
    <svg viewBox="0 0 200 200" className="h-48 w-48 sm:h-56 sm:w-56" aria-hidden>
      {!inBox && (
        <g>
          {/* 杯子 */}
          <path d="M 76 70 L 84 160 Q 100 168 116 160 L 124 70 Z" fill="#FFFFFF" stroke="#84bed7" strokeWidth="2" />
          <rect x="72" y={teaLevel} width="56" height={160 - teaLevel} fill="#C98B4A" opacity="0.85" clipPath="inset(0 0 0 0 round 0 0 10px 10px)" />
          {showMilkSwirl && (
            <path d="M 80 110 Q 100 130 120 110" stroke="#FFF7E6" strokeWidth="6" fill="none" strokeLinecap="round">
              <animate attributeName="d" values="M 80 110 Q 100 130 120 110;M 80 115 Q 100 95 120 115;M 80 110 Q 100 130 120 110" dur="1.6s" repeatCount="indefinite" />
            </path>
          )}
          {showPearls &&
            [0, 1, 2, 3].map((i) => (
              <circle key={i} cx={86 + i * 10} cy={150 - (i % 2) * 6} r="5" fill="#2b1a0a" />
            ))}
          {showLid && <ellipse cx="100" cy="70" rx="26" ry="6" fill="#84bed7" />}
          {showLid && <rect x="97" y="56" width="6" height="16" rx="2" fill="#2a6ea2" />}
        </g>
      )}

      {inBox && !delivered && (
        <g>
          {/* 外送箱 */}
          <rect x="60" y="70" width="80" height="60" rx="8" fill="#2a6ea2" />
          <rect x="68" y="80" width="64" height="40" rx="4" fill="#84bed7" opacity="0.5" />
          {/* 摩托車 */}
          <g transform={riding ? "translate(0,0)" : undefined}>
            <circle cx="50" cy="160" r="14" fill="none" stroke="#1B1B1B" strokeWidth="4" />
            <circle cx="150" cy="160" r="14" fill="none" stroke="#1B1B1B" strokeWidth="4" />
            <path d="M 50 160 L 90 140 L 140 140 L 150 160" stroke="#2a6ea2" strokeWidth="6" fill="none" strokeLinecap="round" />
            {riding && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 6 0; 0 0"
                dur="0.6s"
                repeatCount="indefinite"
              />
            )}
          </g>
          {atRedLight && (
            <g>
              <rect x="168" y="60" width="10" height="30" rx="3" fill="#1B1B1B" />
              <circle cx="173" cy="68" r="3.5" fill="#E05555">
                <animate attributeName="fill" values="#E05555;#E05555;#4CAF6D;#4CAF6D" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="173" cy="78" r="3.5" fill="#4CAF6D">
                <animate attributeName="fill" values="#4CAF6D;#4CAF6D;#E05555;#E05555" dur="2.4s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
        </g>
      )}

      {delivered && (
        <g>
          {/* 帕菲（簡化的雲朵形狀）伸手接過飲料 */}
          <ellipse cx="100" cy="120" rx="46" ry="34" fill="#EFEBF5" stroke="#5B4082" strokeWidth="2" />
          <circle cx="86" cy="110" r="4" fill="#35254B" />
          <circle cx="114" cy="110" r="4" fill="#35254B" />
          <path d="M 88 128 Q 100 136 112 128" stroke="#35254B" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* 送到手裡的飲料杯 */}
          <path d="M 92 150 L 96 182 Q 100 186 104 182 L 108 150 Z" fill="#FFFFFF" stroke="#84bed7" strokeWidth="2" />
          <rect x="90" y="160" width="20" height="22" fill="#C98B4A" opacity="0.85" />
        </g>
      )}
    </svg>
  );
}
