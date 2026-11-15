"use client";

import { useEffect } from "react";
import { IP_CHAR_IDS, IpLayouts, IpCharId, defaultLayouts, sanitizeLayouts } from "@/lib/home/ipLayout";

/**
 * 後台「IP 角色版面」預覽專用：只有網址帶 ?ipPreview=1 且頁面是被嵌在 iframe 裡時才啟動，一般訪客完全不受影響。
 * - 接收「同網域」父頁面（後台）傳來的角色版面草稿（每個欄位都重新驗證），只改變這個 iframe 內的顯示，不寫入任何資料。
 * - 回報主視覺區與每隻角色「實際版面方塊」的位置（量測真實 DOM），讓後台的拖曳控制點對得精準。
 */
export const IP_PREVIEW_FLAG = "ipPreview";

export function isIpPreview(): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;
  return new URLSearchParams(window.location.search).get(IP_PREVIEW_FLAG) === "1";
}

export default function IpLayoutPreviewBridge({ onLayouts }: { onLayouts: (l: IpLayouts) => void }) {
  useEffect(() => {
    if (!isIpPreview()) return;
    const origin = window.location.origin;
    const post = (m: unknown) => window.parent.postMessage(m, origin);
    const sendRects = () => {
      const hero = document.querySelector("[data-home-hero]");
      if (!hero) return;
      const hr = hero.getBoundingClientRect();
      const figs: Record<string, { left: number; top: number; w: number; h: number; hidden: boolean }> = {};
      for (const id of IP_CHAR_IDS) {
        const el = document.querySelector<HTMLElement>(`[data-ip-id="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        figs[id] = { left: r.left - hr.left, top: r.top - hr.top, w: r.width, h: r.height, hidden: el.dataset.ipHidden === "1" };
      }
      post({ type: "nande-ip-hero", y: hr.top + window.scrollY, w: hr.width, h: hr.height, docH: document.documentElement.scrollHeight, figs, viewport: window.innerWidth });
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; layouts?: unknown } | null;
      if (d?.type === "nande-ip-set") {
        onLayouts(sanitizeLayouts(d.layouts, defaultLayouts()));
        requestAnimationFrame(() => requestAnimationFrame(sendRects));
      }
    };
    window.addEventListener("message", onMsg);
    window.addEventListener("resize", sendRects);
    const hero = document.querySelector("[data-home-hero]");
    const ro = typeof ResizeObserver !== "undefined" && hero ? new ResizeObserver(sendRects) : null;
    if (ro && hero) ro.observe(hero);
    post({ type: "nande-ip-ready" });
    sendRects();
    const t = setTimeout(sendRects, 800); // 圖片／字型載入後版面可能再變動
    const t2 = setTimeout(sendRects, 2000);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("resize", sendRects);
      ro?.disconnect();
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [onLayouts]);
  return null;
}
export type { IpCharId };
