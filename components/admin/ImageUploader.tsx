"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

export default function ImageUploader({
  value,
  onChange,
  label = "圖片",
  onDimensions,
  fit = "cover",
  required = false,
  requiredReason,
  showRemove = true,
  removeLabel = "刪除圖片",
  removeConfirm,
  removedNote,
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  label?: string;
  onDimensions?: (width: number, height: number) => void;
  /** 預覽方式：預設 cover（原本行為）；小圖類用 contain，才看得到完整圖片 */
  fit?: "cover" | "contain";
  /** 必要圖片：不顯示刪除按鈕，改顯示不能刪除的原因（只能更換）。 */
  required?: boolean;
  requiredReason?: string;
  /** 預設 true：有圖片時顯示「刪除圖片」（把欄位清成空字串）。已有自己清除機制的欄位可設 false。 */
  showRemove?: boolean;
  removeLabel?: string;
  removeConfirm?: string;
  /** 刪除後顯示的提示（預設提醒要按儲存才會生效）。 */
  removedNote?: string;
}) {
  const [justRemoved, setJustRemoved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    // 有些用途（例如身分證背面卡牌圖）需要保留圖片原始比例，不能被強制拉伸
    // 或裁切——這裡先讀出圖片實際的像素寬高，呼叫端可以存起來，畫面上用
    // aspect-ratio 顯示，而不是套用固定的寬高。
    if (onDimensions) {
      try {
        const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(objectUrl);
          };
          img.onerror = reject;
          img.src = objectUrl;
        });
        onDimensions(dims.width, dims.height);
      } catch {
        // 讀不到尺寸也不影響上傳本身，就不特別處理
      }
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "圖片上傳失敗，請稍後再試一次。");
        return;
      }
      setJustRemoved(false);
      onChange(data.url);
    } catch {
      setError("圖片上傳失敗，請確認網路連線後再試一次。");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    if (!window.confirm(removeConfirm ?? "確定要刪除這張圖片嗎？\n刪除後這個位置會恢復成沒有圖片；舊檔案若沒有其他地方在使用，會移到 uploads\\_trash（可找回）。")) return;
    setError(null);
    setJustRemoved(true);
    onChange("");
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-white/5">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="目前圖片預覽" className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`} />
          ) : (
            <ImagePlus size={22} className="text-ink-400" />
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-1.5 text-sm transition hover:border-transit-400 disabled:opacity-60"
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                上傳中…
              </span>
            ) : value ? (
              "更換圖片"
            ) : (
              "上傳圖片"
            )}
          </button>
          {value && !required && showRemove && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              data-testid="image-remove"
              className="ml-2 inline-flex items-center gap-1 rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-1.5 text-sm text-red-500 transition hover:border-red-400 disabled:opacity-60"
            >
              <Trash2 size={13} /> {removeLabel}
            </button>
          )}
          {value && required && (
            <p className="mt-1 text-xs text-ink-400" data-testid="image-required-note">
              這是必要的圖片，無法刪除，只能更換。{requiredReason ? requiredReason : ""}
            </p>
          )}
          {!value && justRemoved && (
            <p className="mt-1 text-xs text-lantern-600" data-testid="image-removed-note">
              {removedNote ?? "已刪除圖片。請按頁面的「儲存」，前台才會真的移除。"}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-400">支援 JPG、PNG、WebP，10MB 以下</p>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>
    </div>
  );
}
