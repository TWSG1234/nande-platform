"use client";

import { Area, Decoration, buildDecorationCss, classFor, visibleIn } from "@/lib/home/decorations";

/**
 * 首頁裝飾圖層（透明底 PNG）。固定層級：首頁底色 → 本圖層 → 首頁內容。
 *
 * 做法（不是靠「猜一個 z-index 數字」）：
 *  - area="body"：放在首頁根容器（relative）的第一個子元素，使用 -z-10。負 z-index 的圖層一定畫在
 *    「同一個堆疊內所有一般流內容與有定位內容」的下面、畫在 body 底色的上面；所以首頁任何文字、卡片、
 *    公告、按鈕、IP 角色（不論它們的 z-index 是 auto 或 10）永遠在它上面，內容完全不需要被提高或修改。
 *  - area="hero"：放在 Hero 橫幅內，緊接在橫幅自己的背景動畫之後、所有內容之前（DOM 順序），
 *    z-0；Hero 內的文字區塊（relative）與 IP 角色（z-10）都在它後面／上面。
 *  - 整層 pointer-events-none（圖片也是）：不攔截滑鼠、觸控；absolute 脫離排版流程，不影響任何內容的位置與尺寸；
 *    overflow-hidden 不會產生橫向捲軸。
 *  - 單張圖片載入失敗只會隱藏那一張，不影響頁面。
 */
export default function DecorationLayer({ items, area, force }: { items: Decoration[]; area: Area; force?: "desktop" | "mobile" }) {
  const list = visibleIn(items, area);
  if (!list.length) return null;
  const css = buildDecorationCss(list, force);
  return (
    <div
      aria-hidden="true"
      data-decor-layer={area}
      data-decor-scope={force}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${area === "body" ? "-z-10" : "z-0"}`}
    >
      <style>{css}</style>
      {list.map((d) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={d.id}
          src={d.imageUrl}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className={`pointer-events-none absolute select-none ${classFor(d.id)}`}
        />
      ))}
    </div>
  );
}
