"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DECOR_CSS, decorStyle, visibleDecor, type DecorImage } from "@/lib/infoBoxDecor";

/** 資訊框裝飾圖片用的固定 CSS（整個清單只放一份）。 */
export function DecorStyle() {
  return <style>{DECOR_CSS}</style>;
}

/**
 * 校園／生活座標的資訊框（前台清單與後台預覽共用同一個元件，所以後台看到的就是前台的樣子）。
 * 裝飾圖片放在「資訊框本身」這個定位容器裡：絕對定位、畫在文字下方、不攔截滑鼠、不影響資訊框高度。
 * as="div"＝後台預覽用（不是連結）。
 */
export default function InfoCard({
  href,
  title,
  description,
  footer,
  images,
  as = "link",
  testId,
  boxId,
}: {
  href?: string;
  title: string;
  description: string;
  footer?: React.ReactNode;
  images?: DecorImage[];
  as?: "link" | "div";
  testId?: string;
  boxId?: string;
}) {
  const decor = visibleDecor(images);
  const cls =
    "ibd-wrap group block rounded-xl2 border border-ink-100 dark:border-white/10 bg-card dark:bg-canvas-darkcard p-5 hover:shadow-soft dark:hover:shadow-softdark hover:-translate-y-0.5 transition-all";
  const inner = (
    <>
      {decor.length > 0 && (
        <span className="ibd-layer" aria-hidden="true" data-decor-layer>
          {decor.map((d) => (
            <span key={d.id || d.imageUrl} className={`ibd ${d.mobileVisible ? "" : "ibd-nm"}`} style={decorStyle(d) as React.CSSProperties} data-decor-id={d.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.imageUrl} alt="" draggable={false} loading="lazy" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = "none")} />
            </span>
          ))}
        </span>
      )}
      <span className="ibd-content block">
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold text-ink-900 dark:text-white group-hover:text-transit-600 dark:group-hover:text-transit-300 transition-colors">{title}</span>
          <ChevronRight size={15} className="text-ink-400 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
        <span className="mt-1.5 block text-sm text-ink-400 leading-relaxed line-clamp-2">{description}</span>
        {footer}
      </span>
    </>
  );
  if (as === "div" || !href) return <div className={cls} data-testid={testId} data-box-id={boxId}>{inner}</div>;
  return (
    <Link href={href} className={cls} data-testid={testId} data-box-id={boxId}>
      {inner}
    </Link>
  );
}
