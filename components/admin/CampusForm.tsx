"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InfoBoxDecorEditor from "@/components/admin/InfoBoxDecorEditor";
import ImageUploader from "@/components/admin/ImageUploader";
import BilingualField from "@/components/admin/BilingualField";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { EnglishSource } from "@/lib/translationService";

export type CampusFormValue = {
  id: string;
  category: string; // 校園分類 id（school_units／culture／管理員自訂）
  image: string | null;
  nameZh: string;
  nameEn: string;
  nameEnSource: EnglishSource;
  descriptionZh: string;
  descriptionEn: string;
  descriptionEnSource: EnglishSource;
  detailsZh: string;
  detailsEn: string;
  detailsEnSource: EnglishSource;
  mainResponsibilityZh: string;
  mainResponsibilityEn: string;
  mainResponsibilityEnSource: EnglishSource;
  schoolTimesText: string;
  order: number;
  isPublished: boolean;
};

export default function CampusForm({
  initial,
  isNew,
  onSubmit,
  submitLabel = "儲存變更",
}: {
  initial?: Partial<CampusFormValue>;
  isNew?: boolean;
  onSubmit: (value: CampusFormValue) => Promise<{ ok: boolean; error?: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [cats, setCats] = useState<{ id: string; nameZh: string }[]>([]);
  useEffect(() => {
    fetch("/api/admin/campus-categories").then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => {});
  }, []);
  const [value, setValue] = useState<CampusFormValue>({
    id: initial?.id || "",
    category: initial?.category || "culture",
    image: initial?.image ?? null,
    nameZh: initial?.nameZh || "",
    nameEn: initial?.nameEn || "",
    nameEnSource: initial?.nameEnSource || "AUTO",
    descriptionZh: initial?.descriptionZh || "",
    descriptionEn: initial?.descriptionEn || "",
    descriptionEnSource: initial?.descriptionEnSource || "AUTO",
    detailsZh: initial?.detailsZh || "",
    detailsEn: initial?.detailsEn || "",
    detailsEnSource: initial?.detailsEnSource || "AUTO",
    mainResponsibilityZh: initial?.mainResponsibilityZh || "",
    mainResponsibilityEn: initial?.mainResponsibilityEn || "",
    mainResponsibilityEnSource: initial?.mainResponsibilityEnSource || "AUTO",
    schoolTimesText: initial?.schoolTimesText || "",
    order: initial?.order ?? 0,
    isPublished: initial?.isPublished ?? true,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    let result: { ok: boolean; error?: string };
    try {
      result = await onSubmit(value);
    } catch {
      result = { ok: false, error: "無法連到伺服器，請確認網站是否正在執行後再試一次。" };
    }
    setSaving(false);
    if (result.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      setTimeout(() => router.push("/admin/campus"), 600);
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
            placeholder="例如：why-flag-raising"
            value={value.id}
            onChange={(e) => setValue({ ...value, id: e.target.value })}
            className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">分類</label>
        <select
          value={value.category}
          data-testid="campus-category-select"
          onChange={(e) => setValue({ ...value, category: e.target.value })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameZh}
            </option>
          ))}
          {!cats.some((c) => c.id === value.category) && <option value={value.category}>{value.category}（目前分類）</option>}
        </select>
      </div>

      <ImageUploader value={value.image} onChange={(url) => setValue({ ...value, image: url })} />

      <BilingualField
        labelZh="標題（中文）"
        labelEn="Title (English)"
        required
        value={{ zh: value.nameZh, en: value.nameEn, source: value.nameEnSource }}
        onChange={(next) => setValue({ ...value, nameZh: next.zh, nameEn: next.en, nameEnSource: next.source })}
      />

      <BilingualField
        labelZh="介紹（中文）"
        labelEn="Description (English)"
        required
        multiline
        value={{ zh: value.descriptionZh, en: value.descriptionEn, source: value.descriptionEnSource }}
        onChange={(next) =>
          setValue({ ...value, descriptionZh: next.zh, descriptionEn: next.en, descriptionEnSource: next.source })
        }
      />

      {value.category === "school_units" && (
        <BilingualField
          labelZh="主要負責事務（中文，選填）"
          labelEn="Main Responsibility (English)"
          value={{
            zh: value.mainResponsibilityZh,
            en: value.mainResponsibilityEn,
            source: value.mainResponsibilityEnSource,
          }}
          onChange={(next) =>
            setValue({
              ...value,
              mainResponsibilityZh: next.zh,
              mainResponsibilityEn: next.en,
              mainResponsibilityEnSource: next.source,
            })
          }
        />
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">各校時間（選填，升旗／午休這類各校時間不同的項目用）</label>
        <p className="mb-1.5 text-xs text-ink-400">
          一行一間學校，格式「學校名稱｜時間」，例如：屏東縣屏榮高級中學｜7:45～8:00。會直接顯示在校園座標卡片的介紹文字下方；留空就不顯示。
        </p>
        <textarea
          rows={4}
          value={value.schoolTimesText}
          onChange={(e) => setValue({ ...value, schoolTimesText: e.target.value })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        />
      </div>

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
          onClick={() => router.push("/admin/campus")}
          className="rounded-lg border border-ink-100 dark:border-ink-800 px-5 py-2 text-sm transition hover:border-transit-400"
        >
          取消
        </button>
      </div>
      {!isNew && value.id && (
        <InfoBoxDecorEditor scope="campus" boxId={value.id} title={value.nameZh} description={value.descriptionZh} />
      )}
      {isNew && <p className="text-xs text-ink-400">裝飾圖片：新增並儲存後，再回到「編輯」即可加入並拖曳定位。</p>}
    </form>
  );
}
