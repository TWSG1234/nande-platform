"use client";

import { useEffect, useRef, useState } from "react";
import { decodeGif, GifCompositor } from "@/lib/chinese/gifDecode";

export type CorrectAnimationConfig =
  | { mode: "default" }
  | { mode: "none" }
  | { mode: "custom"; format: "mp4" | "gif" | "svg"; src: string; svgMs?: number };

/** loading＝載入中；playing＝正在播放；ended＝播完並停在最後一幀；failed＝無法播放（改顯示文字／圖示）。 */
export type MediaState = "loading" | "playing" | "ended" | "failed";

/** 保險：影片若一直沒有觸發 ended，超過這個時間就當作播完（只改狀態，絕不隱藏畫面）。 */
const VIDEO_GUARD_MS = 90_000;

/**
 * 管理員上傳的「答題成功動畫」本體（放在成功彈窗裡）。三種格式都由程式實際控制「播完後停在最後一幀」：
 *  - MP4：不設 loop，ended 後只 pause，不重設時間、不隱藏，畫面自然停在最後一幀。
 *  - GIF：<img> 做不到，所以自行解出每一格，依各格延遲畫到 <canvas>，最後一格畫完就停（不循環）。
 *  - SVG：只接受「有限時間且 fill=freeze」的動畫（上傳時檢查），瀏覽器本身就會停在最後狀態；以 <img> 載入，不執行腳本。
 * 「重新觀看」只改 playId：同一個 video／canvas 元素回到第一幀重播（不會閃爍、不會重新建立彈窗）。
 * 這個元件不做任何答題判定。
 */
export default function CustomCorrectAnimation({
  config,
  playId,
  onState,
}: {
  config: Extract<CorrectAnimationConfig, { mode: "custom" }>;
  playId: number;
  onState?: (s: MediaState) => void;
}) {
  const [state, setStateRaw] = useState<MediaState>("loading");
  const cbRef = useRef(onState);
  cbRef.current = onState;
  const setState = (s: MediaState) => {
    setStateRaw(s);
    cbRef.current?.(s);
  };

  return (
    <div
      data-testid="correct-animation"
      data-format={config.format}
      data-state={state}
      data-play-id={playId}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      {config.format === "mp4" ? (
        <VideoMedia src={config.src} playId={playId} setState={setState} />
      ) : config.format === "gif" ? (
        <GifMedia src={config.src} playId={playId} setState={setState} />
      ) : (
        <SvgMedia src={config.src} playId={playId} svgMs={config.svgMs ?? 0} setState={setState} />
      )}
    </div>
  );
}

type MediaProps = { src: string; playId: number; setState: (s: MediaState) => void };

function VideoMedia({ src, playId, setState }: MediaProps) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    setState("playing");
    v.muted = true; // React 的 muted 屬性不一定寫進 DOM；手動設定才能保證自動播放
    try {
      v.currentTime = 0;
    } catch {
      /* 尚未載入 metadata 時可忽略，播放本來就從頭開始 */
    }
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => setState("failed"));
    const guard = setTimeout(() => setState("ended"), VIDEO_GUARD_MS);
    return () => clearTimeout(guard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId, src]);
  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="auto"
      controls={false}
      disablePictureInPicture
      onEnded={() => {
        ref.current?.pause(); // 不重設 currentTime、不隱藏：停在最後一幀
        setState("ended");
      }}
      onError={() => setState("failed")}
      className="max-h-full max-w-full object-contain"
    />
  );
}

function GifMedia({ src, playId, setState }: MediaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<GifCompositor | null>(null);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setReady(false);
    compRef.current = null;
    setState("loading");
    fetch(src, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("http");
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (!alive) return;
        const gif = decodeGif(new Uint8Array(buf));
        const c = canvasRef.current;
        if (c) {
          c.width = gif.width;
          c.height = gif.height;
        }
        compRef.current = new GifCompositor(gif);
        setReady(true);
      })
      .catch(() => alive && setState("failed"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const comp = compRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ready || !comp || !canvas || !ctx) return;
    let alive = true;
    comp.reset();
    setState("playing");
    const step = () => {
      if (!alive) return;
      const r = comp.next();
      if (!r) return;
      ctx.putImageData(new ImageData(r.canvas as unknown as ConstructorParameters<typeof ImageData>[0], comp.gif.width, comp.gif.height), 0, 0);
      // 最後一格：畫面就停在這裡，不再前進、不循環；等這一格的顯示時間過後才標示「播完」
      timerRef.current = setTimeout(() => (r.last ? alive && setState("ended") : step()), r.delayMs);
    };
    step();
    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, playId]);

  return <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" aria-hidden="true" />;
}

function SvgMedia({ src, playId, svgMs, setState }: MediaProps & { svgMs: number }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setState("loading");
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId, src]);
  return (
    // 每次 playId 變動就換一個 key＋網址，瀏覽器會重新載入 SVG，動畫從頭播放；結束後瀏覽器維持最後狀態（fill=freeze）
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={playId}
      src={`${src}${src.includes("?") ? "&" : "?"}p=${playId}`}
      alt=""
      onLoad={() => {
        setState("playing");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setState("ended"), svgMs);
      }}
      onError={() => setState("failed")}
      className="max-h-full max-w-full object-contain"
    />
  );
}
