"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/admin/ImageUploader";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

const CATEGORY_OPTIONS = [
  { value: "home", label: "首頁" },
  { value: "campus", label: "校園座標" },
  { value: "life", label: "生活座標" },
  { value: "chinese", label: "中文學習" },
  { value: "calendar", label: "台灣行事曆" },
  { value: "characters", label: "IP角色" },
  { value: "about", label: "關於我們" },
  { value: "other", label: "其他" },
];

export type OfficialImageFormValue = {
  url: string | null;
  title: string;
  category: string;
  usage: string;
  isActive: boolean;
};

export default function OfficialImageForm({
  initial,
  onSubmit,
  submitLabel = "儲存變更",
}: {
  initial?: Partial<OfficialImageFormValue>;
  onSubmit: (value: OfficialImageFormValue) => Promise<{ ok: boolean; error?: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<OfficialImageFormValue>({
    url: initial?.url ?? null,
    title: initial?.title || "",
    category: initial?.category || "other",
    usage: initial?.usage || "",
    isActive: initial?.isActive ?? true,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.url) {
      setStatus({ type: "error", text: "請先上傳圖片。" });
      return;
    }
    setSaving(true);
    setStatus(null);
    const result = await onSubmit(value);
    setSaving(false);
    if (result.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      setTimeout(() => router.push("/admin/images"), 600);
    } else {
      setStatus({ type: "error", text: result.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <StatusBanner status={status} />

      <ImageUploader
        value={value.url}
        onChange={(url) => setValue({ ...value, url })}
        label={value.url ? "目前圖片（按下方按鈕可替換）" : "上傳圖片"}
        required
        requiredReason="每筆官方圖片紀錄都必須有一張圖片；若這筆不需要了，請刪除整筆紀錄。"
      />

      <div>
        <label className="mb-1 block text-sm font-medium">圖片名稱</label>
        <input
          required
          value={value.title}
          onChange={(e) => setValue({ ...value, title: e.target.value })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">分類</label>
        <select
          value={value.category}
          onChange={(e) => setValue({ ...value, category: e.target.value })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">使用位置（選填，方便自己標記，例如「校園座標－升旗卡片」）</label>
        <input
          value={value.usage}
          onChange={(e) => setValue({ ...value, usage: e.target.value })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.isActive} onChange={(e) => setValue({ ...value, isActive: e.target.checked })} />
        啟用
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60">
          {saving ? "儲存中…" : submitLabel}
        </button>
        <button type="button" onClick={() => router.push("/admin/images")} className="rounded-lg border border-ink-100 dark:border-ink-800 px-5 py-2 text-sm transition hover:border-transit-400">
          取消
        </button>
      </div>
    </form>
  );
}
