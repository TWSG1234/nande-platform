"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AssistantCorner } from "@/lib/ai/types";

export interface FloatPos {
  /** 與視窗右邊、下邊的距離（px） */
  right: number;
  bottom: number;
}

const DRAG_THRESHOLD = 6; // 移動超過這個距離才算「拖曳」，否則算「點擊」
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readSaved(key: string): FloatPos | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as FloatPos;
    return Number.isFinite(p.right) && Number.isFinite(p.bottom) ? p : null;
  } catch {
    return null;
  }
}

/**
 * 可拖曳的固定定位元素。位置以 right/bottom 儲存，視窗縮放時比較不會跑掉。
 * - 初始位置由 corner + edge（與邊緣距離）決定；量到實際尺寸前 pos 為 null，由呼叫端用 CSS 錨點顯示。
 * - 移動 < 6px 放開 → 觸發 onClick；超過 → 視為拖曳，不觸發 onClick。
 * - 整個元素永遠限制在視窗內，不會拖到看不見。
 * - enabled=false 時不能拖曳，但仍可點擊。
 * - 最後拖曳位置存在 sessionStorage（key 含設定版本，後台改設定後舊位置自動失效）。
 */
export function useDraggable(opts: {
  corner: AssistantCorner;
  edge: number;
  enabled: boolean;
  storageKey: string;
  onClick: () => void;
}) {
  const { corner, edge, enabled, storageKey, onClick } = opts;
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<FloatPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const posRef = useRef<FloatPos | null>(pos);
  posRef.current = pos;
  const drag = useRef<{ x: number; y: number; right: number; bottom: number; moved: boolean; id: number } | null>(null);

  const clamp = useCallback((p: FloatPos): FloatPos => {
    const rect = ref.current?.getBoundingClientRect();
    const w = rect?.width ?? 0;
    const h = rect?.height ?? 0;
    return {
      right: Math.min(Math.max(0, p.right), Math.max(0, window.innerWidth - w)),
      bottom: Math.min(Math.max(0, p.bottom), Math.max(0, window.innerHeight - h)),
    };
  }, []);

  // 量到實際尺寸後，決定初始位置（有存過的拖曳位置就用它）
  useIsoLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    const w = rect?.width ?? 0;
    const h = rect?.height ?? 0;
    const saved = enabled ? readSaved(storageKey) : null;
    const init: FloatPos = {
      right: corner.endsWith("right") ? edge : window.innerWidth - w - edge,
      bottom: corner.startsWith("bottom") ? edge : window.innerHeight - h - edge,
    };
    setPos(clamp(saved ?? init));
  }, [corner, edge, enabled, storageKey, clamp]);

  // 視窗大小改變（含手機旋轉）時，確保角色仍在畫面內
  useEffect(() => {
    const fix = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", fix);
    return () => window.removeEventListener("resize", fix);
  }, [clamp]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const cur = posRef.current ?? { right: edge, bottom: edge };
      drag.current = { x: e.clientX, y: e.clientY, right: cur.right, bottom: cur.bottom, moved: false, id: e.pointerId };
    },
    [edge]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!d.moved) {
        d.moved = true;
        if (enabled) setDragging(true);
      }
      // 停用拖曳時，超過門檻的移動仍視為「拖曳手勢」（放開不會開啟對話框），只是位置不動
      if (enabled) setPos(clamp({ right: d.right - dx, bottom: d.bottom - dy }));
    },
    [clamp, enabled]
  );

  const finish = useCallback(
    (e: React.PointerEvent, cancelled: boolean) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (d.moved) {
        setDragging(false);
        if (!enabled) return;
        try {
          window.sessionStorage.setItem(storageKey, JSON.stringify(posRef.current));
        } catch {
          /* ignore */
        }
      } else if (!cancelled) {
        onClick();
      }
    },
    [onClick, storageKey, enabled]
  );

  return {
    ref,
    pos,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent) => finish(e, false),
      onPointerCancel: (e: React.PointerEvent) => finish(e, true),
    },
  };
}
