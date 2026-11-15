"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InfoBoxDecorEditor from "@/components/admin/InfoBoxDecorEditor";
import ImageUploader from "@/components/admin/ImageUploader";
import BilingualField from "@/components/admin/BilingualField";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { EnglishSource } from "@/lib/translationService";

export type LifeFormValue = {
  id: string;
  categoryId: string;
  titleZh: string;
  titleEn: string;
  titleEnSource: EnglishSource;
  detailZh: string;
  detailEn: string;
  detailEnSource: EnglishSource;
  fullDetailZh: string;
  fullDetailEn: string;
  fullDetailEnSource: EnglishSource;
  tipZh: string;
  tipEn: string;
  tipEnSource: EnglishSource;
  image: string | null;
  order: number;
  isPublished: boolean;
};

export default function LifeForm({
  initial,
  isNew,
  onSubmit,
  submitLabel = "儲存變更",
}: {
  initial?: Partial<LifeFormValue>;
  isNew?: boolean;
  onSubmit: (value: LifeFormValue) => Promise<{ ok: boolean; error?: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<LifeFormValue>({
    id: initial?.id || "",
    categoryId: initial?.categoryId || "dining-etiquette",
    titleZh: initial?.titleZh || "",
    titleEn: initial?.titleEn || "",
    titleEnSource: initial?.titleEnSource || "AUTO",
    detailZh: initial?.detailZh || "",
    detailEn: initial?.detailEn || "",
    detailEnSource: initial?.detailEnSource || "AUTO",
    fullDetailZh: initial?.fullDetailZh || "",
    fullDetailEn: initial?.fullDetailEn || "",
    fullDetailEnSource: initial?.fullDetailEnSource || "AUTO",
    tipZh: initial?.tipZh || "",
    tipEn: initial?.tipEn || "",
    tipEnSource: initial?.tipEnSource || "AUTO",
    image: initial?.image ?? null,
    order: initial?.order ?? 0,
    isPublished: initial?.isPublished ?? true,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; nameZh: string; nameEn: string }[]>([]);
  const [catError, setCatError] = useState("");

  // 分類清單（來自資料庫，不是寫死）。編輯既有項目時，選單會停在它目前所屬的分類。
  useEffect(() => {
    fetch("/api/admin/life-categories")
      .then((r) => r.json())
      .then((d) => {
        if (!d.categories) throw new Error(d.error || "讀取分類失敗");
        setCategories(d.categories);
        setValue((v) => (d.categories.some((c: { id: string }) => c.id === v.categoryId) || d.categories.length === 0 ? v : { ...v, categoryId: isNew ? d.categories[0].id : v.categoryId }));
      })
      .catch((e) => setCatError((e as Error).message));
  }, [isNew]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const result = await onSubmit(value);
    setSaving(false);
    if (result.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      setTimeout(() => router.push("/admin/life"), 600);
    } else {
      setStatus({ type: "error", text: result.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <StatusBanner status={status} />

      {isNew && (
        <div>
          <label className="mb-1 block text-sm font-medium">項目代碼（僅英數字與 -，之後不能修改）</label>
          <input
            required
            placeholder="例如：night-market-etiquette"
            value={value.id}
            onChange={(e) => setValue({ ...value, id: e.target.value })}
            className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">所屬分類</label>
        <select
          value={value.categoryId}
          onChange={(e) => setValue({ ...value, categoryId: e.target.value })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        >
          {!categories.some((c) => c.id === value.categoryId) && <option value={value.categoryId}>{value.categoryId}（目前分類）</option>}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameZh}（{c.nameEn}）</option>
          ))}
        </select>
        {catError && <p className="mt-1 text-xs text-red-500">{catError}</p>}
        <p className="mt-1 text-xs text-ink-400">分類可在「生活座標管理」頁面上方的「分類管理」新增與修改。</p>
      </div>

      <ImageUploader value={value.image} onChange={(url) => setValue({ ...value, image: url })} />

      <BilingualField
        labelZh="標題（中文）"
        labelEn="Title (English)"
        required
        value={{ zh: value.titleZh, en: value.titleEn, source: value.titleEnSource }}
        onChange={(next) => setValue({ ...value, titleZh: next.zh, titleEn: next.en, titleEnSource: next.source })}
      />

      <BilingualField
        labelZh="簡短說明（列表卡片用，中文）"
        labelEn="Short Description (English)"
        required
        multiline
        value={{ zh: value.detailZh, en: value.detailEn, source: value.detailEnSource }}
        onChange={(next) => setValue({ ...value, detailZh: next.zh, detailEn: next.en, detailEnSource: next.source })}
      />

      <BilingualField
        labelZh="詳細說明（詳情頁用，中文）"
        labelEn="Full Description (English)"
        multiline
        value={{ zh: value.fullDetailZh, en: value.fullDetailEn, source: value.fullDetailEnSource }}
        onChange={(next) =>
          setValue({ ...value, fullDetailZh: next.zh, fullDetailEn: next.en, fullDetailEnSource: next.source })
        }
      />

      <BilingualField
        labelZh="小提示（詳情頁，中文，選填）"
        labelEn="Tip (English, optional)"
        multiline
        value={{ zh: value.tipZh, en: value.tipEn, source: value.tipEnSource }}
        onChange={(next) => setValue({ ...value, tipZh: next.zh, tipEn: next.en, tipEnSource: next.source })}
      />

      <div>
        <label className="mb-1 block text-sm font-medium">排序（數字越小越前面）</label>
        <input
          type="number"
          value={value.order}
          onChange={(e) => setValue({ ...value, order: Number(e.target.value) })}
          className="w-32 rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.isPublished}
          onChange={(e) => setValue({ ...value, isPublished: e.target.checked })}
        />
        顯示於網站
      </label>

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
          onClick={() => router.push("/admin/life")}
          className="rounded-lg border border-ink-100 dark:border-ink-800 px-5 py-2 text-sm transition hover:border-transit-400"
        >
          取消
        </button>
      </div>
      {!isNew && value.id && (
        <InfoBoxDecorEditor scope="life" boxId={value.id} title={value.titleZh} description={value.detailZh} />
      )}
      {isNew && <p className="text-xs text-ink-400">裝飾圖片：新增並儲存後，再回到「編輯」即可加入並拖曳定位。</p>}
    </form>
  );
}
