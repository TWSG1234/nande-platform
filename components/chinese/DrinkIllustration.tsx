import { DrinkConfig } from "@/lib/types";

/**
 * A single, reusable drink illustration built from stackable SVG parts:
 * Cup → Liquid (empty/milk/tea/bubbleTea) → Pearls → Ice → CreamFoam → Straw.
 * Every lesson passes a `DrinkConfig` and gets a visually consistent cup —
 * later stages simply add parts on top of the same cup, never a redesign.
 */
export default function DrinkIllustration({ drink, className }: { drink: DrinkConfig; className?: string }) {
  const { liquid, ice, foam, straw } = drink;
  const hasLid = liquid !== "empty";
  const hasPearls = liquid === "bubbleTea";

  const liquidColor =
    liquid === "milk" ? "#FFF6E8" : liquid === "tea" || liquid === "bubbleTea" ? "#C8905E" : "transparent";
  const liquidTopY = liquid === "milk" ? 128 : liquid === "tea" ? 118 : 106;

  return (
    <svg
      viewBox="0 0 200 260"
      className={className}
      role="img"
      aria-label={
        liquid === "empty"
          ? "Empty cup"
          : liquid === "milk"
          ? "Cup of milk"
          : liquid === "tea"
          ? "Cup of milk tea"
          : "Cup of bubble milk tea" + (ice ? " with ice" : "") + (foam ? " and cream foam" : "") + (straw ? " and a straw" : "")
      }
    >
      <defs>
        <clipPath id="cupInner">
          <path d="M48 78 L152 78 L133 226 Q132 232 126 232 L74 232 Q68 232 67 226 Z" />
        </clipPath>
      </defs>

      {/* ── Cup ───────────────────────────────────────────────────────── */}
      <path
        d="M40 72 L160 72 L136 230 Q134 238 126 238 L74 238 Q66 238 64 230 Z"
        fill="#FDFBF7"
        stroke="#D8CFC0"
        strokeWidth="3"
      />
      {/* vertical rib lines for a plastic-cup feel */}
      <g stroke="#EDE6D8" strokeWidth="2" clipPath="url(#cupInner)">
        <line x1="82" y1="80" x2="76" y2="230" />
        <line x1="100" y1="80" x2="100" y2="232" />
        <line x1="118" y1="80" x2="124" y2="230" />
      </g>

      {/* ── Liquid ────────────────────────────────────────────────────── */}
      {liquid !== "empty" && (
        <rect x="30" y={liquidTopY} width="140" height={240 - liquidTopY} fill={liquidColor} clipPath="url(#cupInner)" />
      )}

      {/* ── Pearls (bubble tea only) ──────────────────────────────────── */}
      {hasPearls && (
        <g fill="#3E2A1C" clipPath="url(#cupInner)">
          {[
            [78, 214], [92, 222], [106, 216], [120, 223], [134, 213],
            [85, 202], [100, 206], [115, 201], [72, 195], [128, 196],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="6.5" />
          ))}
        </g>
      )}

      {/* ── Ice cubes ─────────────────────────────────────────────────── */}
      {ice && liquid !== "empty" && (
        <g clipPath="url(#cupInner)">
          {[
            { x: 62, y: 108, r: -12 },
            { x: 92, y: 96, r: 8 },
            { x: 122, y: 110, r: -6 },
            { x: 78, y: 130, r: 14 },
            { x: 112, y: 132, r: -10 },
          ].map((cube, i) => (
            <rect
              key={i}
              x={cube.x}
              y={cube.y}
              width="26"
              height="26"
              rx="6"
              fill="rgba(255,255,255,0.55)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.5"
              transform={`rotate(${cube.r} ${cube.x + 13} ${cube.y + 13})`}
            />
          ))}
        </g>
      )}

      {/* ── Cream foam cap (sits on top of the liquid, under the lid) ──── */}
      {foam && (
        <g clipPath="url(#cupInner)">
          <path d="M46 84 Q100 62 154 84 L154 108 Q100 88 46 108 Z" fill="#FFF3DD" />
          <path d="M46 84 Q100 62 154 84" fill="none" stroke="#F3E3C3" strokeWidth="2" />
        </g>
      )}

      {/* ── Lid ───────────────────────────────────────────────────────── */}
      {hasLid && (
        <g>
          <ellipse cx="100" cy="72" rx="62" ry="11" fill="#F3EEE3" stroke="#D8CFC0" strokeWidth="2.5" />
          <path
            d="M76 66 Q100 44 124 66 Q124 74 100 76 Q76 74 76 66 Z"
            fill="#FBF8F1"
            stroke="#D8CFC0"
            strokeWidth="2"
          />
        </g>
      )}

      {/* ── Straw ─────────────────────────────────────────────────────── */}
      {straw && (
        <g transform="rotate(-13 138 40)">
          <rect x="130" y="4" width="14" height="120" rx="6" fill="#FFFFFF" stroke="#E3B8A0" strokeWidth="2" />
          <rect x="130" y="38" width="14" height="10" fill="#FF9D7A" />
          <rect x="130" y="60" width="14" height="10" fill="#FF9D7A" />
        </g>
      )}
    </svg>
  );
}
