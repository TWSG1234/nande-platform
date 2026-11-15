"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/admin/ImageUploader";
import BilingualField from "@/components/admin/BilingualField";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import AnnouncementLinksEditor from "@/components/admin/AnnouncementLinksEditor";
import type { AnnouncementLinkSetData } from "@/lib/announcementLinks";
import { EnglishSource } from "@/lib/translationService";

export type AnnouncementFormValue = {
  type: "permanent" | "holiday";
  titleZh: string;
  titleEn: string;
  titleEnSource: EnglishSource;
  contentZh: string;
  contentEn: string;
  contentEnSource: EnglishSource;
  image: string | null;
  isPublished: boolean;
  order: number;
  startDate: string; // yyyy-mm-dd，只有 type="holiday" 才用得到
  endDate: string;
  relatedHoliday: string;
  linkSet: AnnouncementLinkSetData; // 文字連結（獨立資料表儲存）
};

export default function AnnouncementForm({
  initial,
  onSubmit,
  submitLabel = "儲存",
  linkTableReady = true,
}: {
  initial?: Partial<AnnouncementFormValue>;
  onSubmit: (value: AnnouncementFormValue) => Promise<{ ok: boolean; error?: string; warning?: string }>;
  linkTableReady?: boolean;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<AnnouncementFormValue>({
    type: initial?.type || "permanent",
    titleZh: initial?.titleZh || "",
    titleEn: initial?.titleEn || "",
    titleEnSource: initial?.titleEnSource || "AUTO",
    contentZh: initial?.contentZh || "",
    contentEn: initial?.contentEn || "",
    contentEnSource: initial?.contentEnSource || "AUTO",
    image: initial?.image ?? null,
    isPublished: initial?.isPublished ?? false,
    order: initial?.order ?? 0,
    startDate: initial?.startDate || "",
    endDate: initial?.endDate || "",
    relatedHoliday: initial?.relatedHoliday || "",
    linkSet: initial?.linkSet ?? { show: true, links: [] },
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const result = await onSubmit(value);
    setSaving(false);
    if (result.ok && result.warning) {
      // 公告本身已儲存，但連結有問題：留在這一頁讓管理員看到說明
      setStatus({ type: "error", text: result.warning });
    } else if (result.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      setTimeout(() => router.push("/admin/announcements"), 600);
    } else {
      setStatus({ type: "error", text: result.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <StatusBanner status={status} />

      <div className="rounded-lg bg-ink-50 dark:bg-white/5 px-3 py-2 text-sm">
        {value.type === "permanent" ? "📌 常駐公告" : "🎉 節假日公告"}——
        {value.type === "permanent" ? "不需要日期，發布後會一直顯示。" : "只有在下面設定的期間內才會顯示。"}
      </div>

      <BilingualField
        labelZh="公告標題（中文）"
        labelEn="Title (English)"
        required
        value={{ zh: value.titleZh, en: value.titleEn, source: value.titleEnSource }}
        onChange={(next) => setValue({ ...value, titleZh: next.zh, titleEn: next.en, titleEnSource: next.source })}
      />

      <BilingualField
        labelZh="公告內容（中文）"
        labelEn="Content (English)"
        required
        multiline
        value={{ zh: value.contentZh, en: value.contentEn, source: value.contentEnSource }}
        onChange={(next) =>
          setValue({ ...value, contentZh: next.zh, contentEn: next.en, contentEnSource: next.source })
        }
      />

      {value.type === "holiday" && (
        <div className="space-y-3 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">開始日期</label>
              <input
                required
                type="date"
                value={value.startDate}
                onChange={(e) => setValue({ ...value, startDate: e.target.value })}
                className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">結束日期</label>
              <input
                required
                type="date"
                value={value.endDate}
                onChange={(e) => setValue({ ...value, endDate: e.target.value })}
                className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">相關節日（選填，例如「中秋節」）</label>
            <input
              value={value.relatedHoliday}
              onChange={(e) => setValue({ ...value, relatedHoliday: e.target.value })}
              className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
            />
          </div>
        </div>
      )}

      <ImageUploader value={value.image} onChange={(url) => setValue({ ...value, image: url })} />

      <AnnouncementLinksEditor value={value.linkSet} onChange={(linkSet) => setValue({ ...value, linkSet })} tableReady={linkTableReady} />

      <div>
        <label className="mb-1 block text-sm font-medium">顯示順序（數字越小越前面）</label>
        <input
          type="number"
          value={value.order}
          onChange={(e) => setValue({ ...value, order: Number(e.target.value) })}
          className="w-32 rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">發布狀態</p>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={!value.isPublished}
              onChange={() => setValue({ ...value, isPublished: false })}
            />
            草稿
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={value.isPublished}
              onChange={() => setValue({ ...value, isPublished: true })}
            />
            發布
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60"
        >
          {saving ? "儲存中…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/announcements")}
          className="rounded-lg border border-ink-100 dark:border-ink-800 px-5 py-2 text-sm transition hover:border-transit-400"
        >
          取消
        </button>
      </div>
    </form>
  );
}
