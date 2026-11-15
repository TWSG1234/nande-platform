/**
 * 資訊框裝飾圖片（純函式）。位置／大小都相對於「資訊框本身」（不是視窗）：
 *   left = x%、top = y%，再 translate(-x%, -y%) → 錨點式，x/y 在 0–100 之間圖片一定完整留在資訊框內。
 *   寬度 = 資訊框寬度的 size%，並限制 24–220px；高度依原圖比例（不變形）。
 *   手機（< 640px）：再乘上 mobileScale%，或選擇手機不顯示。
 * 圖片永遠畫在文字下方、pointer-events:none、alt 為空（純裝飾），而且是 absolute，不會影響資訊框高度。
 */
export interface DecorImage {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  opacity: number;
  mobileScale: number;
  mobileVisible: boolean;
  visible: boolean;
  order: number;
}
export const MIN_PX = 24;
export const MAX_PX = 220;
export const DECOR_SCOPES = ["campus", "life"] as const;
export type DecorScope = (typeof DECOR_SCOPES)[number];

const num = (v: unknown, lo: number, hi: number, fb: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
};
export const safeImg = (v: unknown) => {
  if (typeof v !== "string") return "";
  const s = v.trim().slice(0, 500);
  return s && ((s.startsWith("/") && !s.startsWith("//") && !s.includes("..")) || /^https:\/\//.test(s)) ? s : "";
};

export function sanitizeDecor(input: any, i = 0): DecorImage | null {
  const imageUrl = safeImg(input?.imageUrl);
  if (!imageUrl) return null;
  return {
    id: typeof input?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(input.id) ? input.id : "",
    imageUrl,
    x: Math.round(num(input?.x, 0, 100, 88) * 10) / 10,
    y: Math.round(num(input?.y, 0, 100, 12) * 10) / 10,
    size: Math.round(num(input?.size, 3, 80, 22) * 10) / 10,
    rotate: Math.round(num(input?.rotate, -180, 180, 0)),
    opacity: Math.round(num(input?.opacity, 20, 100, 100)),
    mobileScale: Math.round(num(input?.mobileScale, 30, 150, 80)),
    mobileVisible: input?.mobileVisible !== false,
    visible: input?.visible !== false,
    order: Math.round(num(input?.order, -999, 999, i)),
  };
}

/** 全域 CSS（只含固定樣式；每張圖的數值用 CSS 變數放在 style，不拼接任何自由文字）。 */
export const DECOR_CSS = `
.ibd-wrap{position:relative;overflow:hidden}
.ibd-layer{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.ibd{position:absolute;display:block;left:calc(var(--x)*1%);top:calc(var(--y)*1%);width:clamp(${MIN_PX}px,calc(var(--s)*1%),${MAX_PX}px);transform:translate(calc(var(--x)*-1%),calc(var(--y)*-1%));pointer-events:none;user-select:none;opacity:var(--o)}
.ibd img{display:block;width:100%;height:auto;transform:rotate(var(--r));pointer-events:none}
.ibd-content{position:relative;z-index:1}
@media (max-width:639px){.ibd{width:clamp(${MIN_PX}px,calc(var(--s)*var(--ms)*0.01%),${MAX_PX}px)}.ibd-nm{display:none}}
[data-force-mobile] .ibd{width:clamp(${MIN_PX}px,calc(var(--s)*var(--ms)*0.01%),${MAX_PX}px)}
[data-force-mobile] .ibd-nm{display:none}
`;

export function decorStyle(d: DecorImage): Record<string, string | number> {
  return { "--x": d.x, "--y": d.y, "--s": d.size, "--r": `${d.rotate}deg`, "--o": d.opacity / 100, "--ms": d.mobileScale, zIndex: Math.max(0, Math.min(50, d.order + 1)) } as Record<string, string | number>;
}

export function visibleDecor(list: DecorImage[] | undefined): DecorImage[] {
  return (list ?? []).filter((d) => d.visible && d.imageUrl).sort((a, b) => a.order - b.order);
}
