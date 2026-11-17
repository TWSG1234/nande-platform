"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ImageStage, photoSources, stageAfterError } from "@/lib/photoImage";

/**
 * 投稿照片圖片：Drive 縮圖優先 → 失敗退回原網址 → 再失敗顯示友善佔位。
 * lazy loading + 非同步解碼 + 載入中骨架畫面。外層容器的尺寸／圓角由呼叫端決定（照片牆維持原本的正方形格子）。
 */
export default function PhotoImage({
  imageUrl,
  alt,
  kind,
  className = "",
  eager = false,
}: {
  imageUrl: string | null;
  alt: string;
  kind: "grid" | "detail";
  className?: string;
  eager?: boolean;
}) {
  const { t } = useLanguage();
  const src = photoSources(imageUrl, kind);
  // 網址換了就從頭開始（key 由外層以 imageUrl 區分，這裡再保險）
  const [stage, setStage] = useState<ImageStage>("primary");
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const urlKey = imageUrl ?? "";
  useEffect(() => {
    setStage("primary");
    setLoaded(false);
  }, [urlKey]);

  const current = !src || stage === "failed" ? null : stage === "primary" ? src.primary : src.fallback;

  // 已經在快取中的圖片可能在 React 掛上事件前就載入完成，這裡補檢查，避免骨架畫面卡住
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, [current]);

  if (!src || !current) {
    return (
      <div role="img" aria-label={alt} className="flex h-full w-full min-h-[8rem] flex-col items-center justify-center gap-1.5 text-ink-400">
        <ImageOff size={22} />
        {src && <span className="px-2 text-center text-xs">{t("photo_image_unavailable")}</span>}
      </div>
    );
  }

  return (
    <>
      {/* 照片牆：骨架畫面蓋在正方形格子上；詳情頁：圖片還沒載入前高度是 0，所以骨架畫面要佔位置（載入後換成原圖高度） */}
      {!loaded && <div aria-hidden className={`animate-pulse bg-ink-100/60 dark:bg-white/10 ${kind === "detail" ? "h-64 w-full" : "absolute inset-0"}`} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        key={current}
        src={current}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setStage((s) => stageAfterError(s, Boolean(src.fallback)));
        }}
        className={`${className} ${loaded ? "opacity-100" : kind === "detail" ? "h-0 opacity-0" : "opacity-0"} transition-opacity duration-300`}
      />
    </>
  );
}
