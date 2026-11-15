"use client";

import { useEffect, useRef, useState } from "react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import CustomCorrectAnimation, { MediaState } from "@/components/chinese/CustomCorrectAnimation";

type State = {
  configured: boolean;
  fileName: string;
  format: "mp4" | "gif" | "svg" | "";
  sizeBytes: number;
  previewSrc: string;
  updatedAt: string | null;
  limitText?: string;
  svgKind?: "static" | "animated" | "unsupported" | "unreadable";
  svgSeconds?: number;
  svgProblem?: string;
  fileMissing?: boolean;
};

export default function CorrectAnimationAdmin({ stageId, levelLabel }: { stageId: string; levelLabel: string }) {
  const [state, setState] = useState<State | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewState, setPreviewState] = useState<MediaState>("loading");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const r = await fetch(`/api/admin/chinese/correct-animation?stageId=${encodeURIComponent(stageId)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "讀取失敗");
      setState(j);
      setPreviewFailed(false);
      setPreviewState("loading");
      setPreviewKey((n) => n + 1);
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message || "讀取目前設定失敗，請重新整理頁面。" });
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("stageId", stageId);
      const r = await fetch("/api/admin/chinese/correct-animation", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "上傳失敗，請稍後再試。");
      setStatus({ type: "success", text: "已儲存並立即套用到前台！" });
      await load();
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm(`確定要移除「${levelLabel}」的答題成功動畫嗎？移除後這一關答對時只顯示文字回饋。舊檔會移到 uploads\\_trash，可找回。`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await fetch(`/api/admin/chinese/correct-animation?stageId=${encodeURIComponent(stageId)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "操作失敗，請稍後再試。");
      setStatus({ type: "success", text: "已移除這一關的動畫，前台只顯示文字回饋。" });
      await load();
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-lg border border-ink-100 dark:border-ink-800 px-4 py-2 text-sm transition hover:border-transit-400 disabled:opacity-50";
  const sizeText = state && state.sizeBytes ? (state.sizeBytes >= 1048576 ? `${(state.sizeBytes / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(state.sizeBytes / 1024))} KB`) : "";

  return (
    <section className="mt-6 max-w-2xl rounded-xl border border-ink-100 dark:border-ink-800 p-4" data-testid="stage-animation-block">
      <h2 className="font-display text-lg font-bold">答題成功動畫</h2>
      <p className="mt-1 text-xs text-ink-400">
        只屬於「{levelLabel}」。學生在這一關全部答對時，會跳出置中的「答對了！」彈窗並播放；其他關卡各自設定，互不影響。支援 MP4、GIF、SVG，選好檔案就會立刻上傳並套用到前台。
      </p>
      <StatusBanner status={status} />

      {!state ? (
        <p className="mt-3 text-sm text-ink-400">讀取中…</p>
      ) : !state.configured ? (
        <p className="mt-3 rounded-lg bg-ink-50 dark:bg-white/5 px-3 py-2 text-sm text-ink-500 dark:text-ink-200">尚未設定動畫（答對時仍會跳出成功彈窗，內容為文字與圖示「回答正確！」）</p>
      ) : (
        <div className="mt-3">
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
            <dt className="text-ink-400">檔案名稱</dt>
            <dd className="break-all">{state.fileName || "（未記錄）"}</dd>
            <dt className="text-ink-400">格式</dt>
            <dd>{state.format.toUpperCase()}</dd>
            <dt className="text-ink-400">大小</dt>
            <dd>{sizeText}</dd>
          </dl>
          {state.fileMissing && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10">
              資料庫有這一關的動畫設定，但固定資料夾 uploads/chinese-animation 裡找不到這個檔案（可能被搬走或刪除，也可能在 uploads/_trash 裡）。前台這一關目前只顯示文字，請重新上傳，或把檔案放回原處。
            </p>
          )}
          {state.format === "svg" && (
            <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${state.svgKind === "unsupported" || state.svgKind === "unreadable" ? "bg-red-50 text-red-600 dark:bg-red-500/10" : "bg-ink-50 text-ink-500 dark:bg-white/5 dark:text-ink-200"}`}>
              {state.svgKind === "static" && "靜態 SVG：答對時直接顯示。"}
              {state.svgKind === "animated" && `動畫 SVG（約 ${state.svgSeconds ?? 0} 秒，有限次數且設定 fill="freeze"）：播完會停在最後狀態。`}
              {state.svgKind === "unsupported" && `這個 SVG 不符合「播完停在最後一幀」的規則，前台目前不會播放它（答對時只顯示文字）。原因：${state.svgProblem ?? ""}請重新上傳。`}
              {state.svgKind === "unreadable" && "讀不到這個 SVG 檔案，前台目前只顯示文字。請重新上傳。"}
            </p>
          )}
          <p className="mb-1 mt-3 text-xs text-ink-400">預覽（前台是在答對後的彈窗中以更大的尺寸播放；播完會停在最後一幀）</p>
          <div className="flex h-44 w-full max-w-xs items-center justify-center overflow-hidden rounded-lg bg-ink-50 dark:bg-white/5">
            {previewFailed || previewState === "failed" || (state.format === "svg" && (state.svgKind === "unsupported" || state.svgKind === "unreadable")) ? (
              <p className="px-3 text-center text-xs text-red-500">這個檔案無法播放。前台會自動改成只顯示文字，建議更換檔案。</p>
            ) : (
              <CustomCorrectAnimation
                key={`${state.previewSrc}-${previewKey}`}
                config={{ mode: "custom", format: state.format as "mp4" | "gif" | "svg", src: state.previewSrc, svgMs: Math.round((state.svgSeconds ?? 0) * 1000) }}
                playId={previewKey}
                onState={setPreviewState}
              />
            )}
          </div>
          <button type="button" onClick={() => setPreviewKey((n) => n + 1)} className={`${btn} mt-2 text-xs`}>
            重新播放預覽
          </button>
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium">{state?.configured ? "更換動畫" : "上傳動畫"}</label>
        <input ref={fileRef} type="file" accept=".mp4,.gif,.svg,video/mp4,image/gif,image/svg+xml" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} className="block w-full text-sm" />
        <p className="mt-2 text-xs text-ink-400">
          大小上限：{state?.limitText ?? "MP4 最大 8 MB、GIF 最大 5 MB、SVG 最大 512 KB"}。MP4 請用 H.264；前台會靜音自動播放，播完停在最後一幀。GIF 由前台逐格播放一次後停在最後一格（不會無限循環）。SVG：靜態圖直接顯示；動畫 SVG 必須是有限時間、並設定 fill=&quot;freeze&quot;（CSS 動畫則需 animation-fill-mode: forwards 且不可 infinite），無限循環或點擊才開始的動畫會被拒絕；含腳本或外部連結也會被拒絕。更換時舊檔會移到 uploads\_trash，可找回。
        </p>
        {busy && <p className="mt-2 text-sm text-ink-400">處理中…</p>}
      </div>

      {state?.configured && (
        <button type="button" disabled={busy} onClick={remove} className={`${btn} mt-4 text-red-500`}>
          移除動畫（這一關改為只顯示文字）
        </button>
      )}
    </section>
  );
}
