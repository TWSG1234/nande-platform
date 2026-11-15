"use client";

import { useEffect, useState } from "react";
import type { AssistantSettings } from "@/lib/ai/types";
import type { AvatarState } from "@/lib/ai/avatarState";
import { resolveAssistantImage, resolveStateImage } from "./assistantImage";

/**
 * 威洛頭像：依 state 切換動作圖。
 * - 待機圖永遠留在版面流程中（決定容器大小，和以前一模一樣），動作圖只是疊在上面、
 *   以 object-contain 完整顯示，所以切換圖片時小助理不會跳動、變大變小或移位。
 * - 動作圖載入失敗（網址壞掉）就自動退回待機圖，不會出現破圖或空白。
 * - 切換用 0.2 秒淡入，沒有其他動畫。
 */
export default function WilloAvatar({
  settings,
  state,
  alt,
  customSrc,
}: {
  settings: AssistantSettings;
  state: AvatarState;
  alt: string;
  /** 後台「問題類型」指定的外觀圖（state="custom" 時使用；載入失敗自動退回待機圖） */
  customSrc?: string;
}) {
  const idle = resolveAssistantImage(settings);
  const target = resolveStateImage(settings, state, customSrc);
  const [failed, setFailed] = useState<string[]>([]);
  const showOverlay = state !== "idle" && target.source !== "idle" && !failed.includes(target.src);

  // 預先載入動作圖，第一次切換時不會閃一下
  useEffect(() => {
    for (const s of ["thinking", "life_info", "unresolved"] as const) {
      const { src, source } = resolveStateImage(settings, s);
      if (source !== "idle") {
        const im = new Image();
        im.src = src;
      }
    }
  }, [settings.thinkingImageUrl, settings.unresolvedImageUrl, settings.lifeInfoImageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative" data-avatar-state={state} data-avatar-source={showOverlay ? target.source : "idle"}>
      <style>{`@keyframes willoFade{from{opacity:0}to{opacity:1}}.willo-fade{animation:willoFade .2s ease-out}`}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={idle.src}
        alt={alt}
        width={idle.width}
        height={idle.height}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className={`pointer-events-none block h-auto w-full select-none transition-opacity duration-200 ${showOverlay ? "opacity-0" : "opacity-100"}`}
      />
      {showOverlay && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={target.src}
          src={target.src}
          alt=""
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onError={() => setFailed((f) => [...f, target.src])}
          className="willo-fade pointer-events-none absolute inset-0 block h-full w-full select-none object-contain"
        />
      )}
    </div>
  );
}
