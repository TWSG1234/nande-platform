"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/admin/ImageUploader";
import BilingualField from "@/components/admin/BilingualField";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { EnglishSource } from "@/lib/translationService";

export type CalendarFormValue = {
  id?: string; // 編輯時才有；節日小圖就是綁在這個編號上
  date: string;
  nameZh: string;
  nameEn: string;
  nameEnSource: EnglishSource;
  isHoliday: boolean;
  isMakeup: boolean;
  descriptionZh: string;
  descriptionEn: string;
  descriptionEnSource: EnglishSource;
  originZh: string;
  originEn: string;
  originEnSource: EnglishSource;
  sourceZh: string;
  sourceEn: string;
  noteZh: string;
  noteEn: string;
  noteEnSource: EnglishSource;
  isOfficial: boolean;
  isPublished: boolean;
  imageUrl: string; // 節日小圖（空字串 = 不顯示）
};

export default function CalendarForm({
  initial,
  onSubmit,
  submitLabel = "儲存變更",
}: {
  initial?: Partial<CalendarFormValue>;
  onSubmit: (value: CalendarFormValue) => Promise<{ ok: boolean; error?: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<CalendarFormValue>({
    id: initial?.id,
    date: initial?.date || "",
    nameZh: initial?.nameZh || "",
    nameEn: initial?.nameEn || "",
    nameEnSource: initial?.nameEnSource || "AUTO",
    isHoliday: initial?.isHoliday ?? false,
    isMakeup: initial?.isMakeup ?? false,
    descriptionZh: initial?.descriptionZh || "",
    descriptionEn: initial?.descriptionEn || "",
    descriptionEnSource: initial?.descriptionEnSource || "AUTO",
    originZh: initial?.originZh || "",
    originEn: initial?.originEn || "",
    originEnSource: initial?.originEnSource || "AUTO",
    sourceZh: initial?.sourceZh || "",
    sourceEn: initial?.sourceEn || "",
    noteZh: initial?.noteZh || "",
    noteEn: initial?.noteEn || "",
    noteEnSource: initial?.noteEnSource || "AUTO",
    isOfficial: initial?.isOfficial ?? false,
    isPublished: initial?.isPublished ?? true,
    imageUrl: initial?.imageUrl || "",
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const result = await onSubmit(value);
    setSaving(false);
    if (result.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      setTimeout(() => router.push("/admin/calendar"), 600);
    } else {
      setStatus({ type: "error", text: result.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <StatusBanner status={status} />

      <div>
        <label className="mb-1 block text-sm font-medium">日期</label>
        <input required type="date" value={value.date} onChange={(e) => setValue({ ...value, date: e.target.value })} className={inputClass} />
      </div>

      <BilingualField
        labelZh="節日名稱（中文）"
        labelEn="Name (English)"
        required
        value={{ zh: value.nameZh, en: value.nameEn, source: value.nameEnSource }}
        onChange={(next) => setValue({ ...value, nameZh: next.zh, nameEn: next.en, nameEnSource: next.source })}
      />

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={value.isHoliday} onChange={(e) => setValue({ ...value, isHoliday: e.target.checked })} />
          放假
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={value.isMakeup} onChange={(e) => setValue({ ...value, isMakeup: e.target.checked })} />
          補假日
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={value.isOfficial} onChange={(e) => setValue({ ...value, isOfficial: e.target.checked })} />
          官方資料（需要填寫來源）
        </label>
      </div>

      <BilingualField
        labelZh="簡短介紹（中文）"
        labelEn="Description (English)"
        multiline
        value={{ zh: value.descriptionZh, en: value.descriptionEn, source: value.descriptionEnSource }}
        onChange={(next) =>
          setValue({ ...value, descriptionZh: next.zh, descriptionEn: next.en, descriptionEnSource: next.source })
        }
      />

      <BilingualField
        labelZh="節日由來/故事（中文，選填）"
        labelEn="Origin / Story (English)"
        multiline
        value={{ zh: value.originZh, en: value.originEn, source: value.originEnSource }}
        onChange={(next) => setValue({ ...value, originZh: next.zh, originEn: next.en, originEnSource: next.source })}
      />

      {/* 官方資料來源是機關名稱／固定引用字串，故意不自動翻譯，維持一般輸入框 */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          官方資料來源{value.isOfficial && <span className="text-red-500">（必填）</span>}
        </label>
        <input
          required={value.isOfficial}
          placeholder="例如：行政院人事行政總處"
          value={value.sourceZh}
          onChange={(e) => setValue({ ...value, sourceZh: e.target.value })}
          className={inputClass}
        />
      </div>

      <BilingualField
        labelZh="特殊備註（中文，選填）"
        labelEn="Special Note (English)"
        multiline
        value={{ zh: value.noteZh, en: value.noteEn, source: value.noteEnSource }}
        onChange={(next) => setValue({ ...value, noteZh: next.zh, noteEn: next.en, noteEnSource: next.source })}
      />

      {/* 節日小圖：顯示在前台「節日詳情」彈窗標題右側；只綁定這一筆節日（以節日編號對應），不靠排序或檔名 */}
      <div className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
        <ImageUploader
          label="節日小圖（選填）"
          fit="contain"
          value={value.imageUrl}
          onChange={(url) => setValue({ ...value, imageUrl: url })}
          removeLabel="移除小圖"
          removedNote="已移除小圖。請按「儲存變更」，前台才會真的不再顯示。"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-400">
          <span>
            對應的節日：{value.nameZh || "（尚未填寫名稱）"}
            {value.id ? `（編號 ${value.id}）` : "（儲存後建立編號）"}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-400">
          建議使用背景透明的 PNG；前台以約 100×100 的方框完整顯示（不裁切、不拉伸）。更換或移除後，舊圖會移到 uploads\_trash（可找回），不會被永久刪除。要按下「儲存」才會生效。
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.isPublished} onChange={(e) => setValue({ ...value, isPublished: e.target.checked })} />
        發布（顯示在網站行事曆上）
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60">
          {saving ? "儲存中…" : submitLabel}
        </button>
        <button type="button" onClick={() => router.push("/admin/calendar")} className="rounded-lg border border-ink-100 dark:border-ink-800 px-5 py-2 text-sm transition hover:border-transit-400">
          取消
        </button>
      </div>
    </form>
  );
}
