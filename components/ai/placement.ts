import type { AssistantSettings } from "@/lib/ai/types";

const GAP = 12; // 威洛與對話框的距離
const MARGIN = 8; // 對話框與畫面邊緣的最小距離

/**
 * 計算對話框位置（前台與後台預覽共用）。
 * 優先放在威洛上方（威洛偏右半邊就靠右緣對齊，偏左半邊靠左緣對齊）；
 * 上方放不下改放下方；左右、上下都夾在畫面內，所以不會超出螢幕。
 * willo 為威洛在畫面（viewport）座標中的左上角與尺寸。
 */
export function computePanelStyle(
  vp: { w: number; h: number },
  willo: { left: number; top: number; width: number; height: number },
  settings: Pick<AssistantSettings, "panelWidth" | "panelHeight">
): { left: number; top: number; width: number; height: number } {
  const pw = Math.min(settings.panelWidth, vp.w - MARGIN * 2);
  const ph = Math.min(settings.panelHeight, vp.h - MARGIN * 2);
  const alignRight = willo.left + willo.width / 2 >= vp.w / 2;
  const rawLeft = alignRight ? willo.left + willo.width - pw : willo.left;
  const left = Math.min(Math.max(MARGIN, rawLeft), vp.w - pw - MARGIN);
  const spaceAbove = willo.top - GAP - MARGIN;
  const spaceBelow = vp.h - (willo.top + willo.height) - GAP - MARGIN;
  let top: number;
  if (spaceAbove >= ph) top = willo.top - GAP - ph;
  else if (spaceBelow >= ph) top = willo.top + willo.height + GAP;
  else top = Math.min(Math.max(MARGIN, spaceAbove >= spaceBelow ? willo.top - GAP - ph : willo.top + willo.height + GAP), vp.h - ph - MARGIN);
  return { left, top, width: pw, height: ph };
}
