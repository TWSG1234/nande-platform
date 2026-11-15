"use client";

import { useEffect } from "react";
import { AREAS, Area, DEFAULT_DESKTOP, DEFAULT_MOBILE, Decoration, sanitizeDevice } from "@/lib/home/decorations";

/**
 * 後台「首頁主視覺裝飾」預覽專用：只有網址帶 ?decorPreview=1 且頁面是被嵌在 iframe 裡時才啟動，一般訪客完全不受影響。
 * - 接收「同網域」父頁面（後台）傳來的裝飾草稿，只改變這個 iframe 內的顯示，不寫入任何資料。
 * - 回報主視覺區域的位置與尺寸，讓後台把拖曳控制點精準對齊到真正的首頁版面。
 */
export function normalizeItems(raw: unknown): Decoration[] {
  if (!Array.isArray(raw)) return [];
  const out: Decoration[] = [];
  for (const r of raw.slice(0, 60)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.imageUrl !== "string") continue;
    if (!/^(\/uploads\/|blob:|data:image\/png)/.test(o.imageUrl)) continue; // 只接受站內上傳圖片（或預覽用的本機圖片）
    out.push({
      id: o.id,
      name: typeof o.name === "string" ? o.name.slice(0, 40) : "",
      imageUrl: o.imageUrl,
      naturalWidth: Number(o.naturalWidth) || 0,
      naturalHeight: Number(o.naturalHeight) || 0,
      isVisible: o.isVisible !== false,
      area: AREAS.includes(o.area as Area) ? (o.area as Area) : "hero",
      sortOrder: Number(o.sortOrder) || 0,
      desktop: sanitizeDevice(o.desktop, DEFAULT_DESKTOP),
      mobile: sanitizeDevice(o.mobile, DEFAULT_MOBILE),
    });
  }
  return out;
}

export default function DecorPreviewBridge({ onItems }: { onItems: (items: Decoration[]) => void }) {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    if (new URLSearchParams(window.location.search).get("decorPreview") !== "1") return;
    const origin = window.location.origin;
    const post = (m: unknown) => window.parent.postMessage(m, origin);
    const sendRect = () => {
      const el = document.querySelector("[data-home-hero]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      post({ type: "nande-decor-hero", x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height, docH: document.documentElement.scrollHeight });
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; items?: unknown } | null;
      if (d?.type === "nande-decor-set") {
        onItems(normalizeItems(d.items));
        requestAnimationFrame(sendRect);
      }
    };
    window.addEventListener("message", onMsg);
    window.addEventListener("resize", sendRect);
    const hero = document.querySelector("[data-home-hero]");
    const ro = typeof ResizeObserver !== "undefined" && hero ? new ResizeObserver(sendRect) : null;
    if (ro && hero) ro.observe(hero);
    post({ type: "nande-decor-ready" });
    sendRect();
    const t = setTimeout(sendRect, 800); // 圖片／字型載入後版面可能再變動
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("resize", sendRect);
      ro?.disconnect();
      clearTimeout(t);
    };
  }, [onItems]);
  return null;
}
