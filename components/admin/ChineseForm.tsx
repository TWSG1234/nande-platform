"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Vocabulary = { chinese: string; pinyin: string; english: string };
type Sentence = { speaker: string; chinese: string; pinyin: string; english: string };
type Drink = { liquid: "empty" | "milk" | "tea" | "bubbleTea"; ice: boolean; foam: boolean; straw: boolean };

export type ChineseFormValue = {
  id: string;
  categoryId: string;
  level: number;
  titleZh: string;
  titleEn: string;
  image: string | null;
  drink: Drink;
  vocabulary: Vocabulary[];
  sentences: Sentence[];
  order: number;
  isPublished: boolean;
};

const LIQUID_OPTIONS: { value: Drink["liquid"]; label: string }[] = [
  { value: "empty", label: "空杯（尚未點餐）" },
  { value: "milk", label: "奶類飲品" },
  { value: "tea", label: "茶類飲品" },
  { value: "bubbleTea", label: "珍珠奶茶" },
];

export default function ChineseForm({
  initial,
  isNew,
  onSubmit,
  submitLabel = "儲存變更",
}: {
  initial?: Partial<ChineseFormValue>;
  isNew?: boolean;
  onSubmit: (value: ChineseFormValue) => Promise<{ ok: boolean; error?: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; nameZh: string }[]>([]);
  const [value, setValue] = useState<ChineseFormValue>({
    id: initial?.id || "",
    categoryId: initial?.categoryId || "",
    level: initial?.level || 1,
    titleZh: initial?.titleZh || "",
    titleEn: initial?.titleEn || "",
    image: initial?.image ?? null,
    drink: initial?.drink || { liquid: "empty", ice: false, foam: false, straw: false },
    vocabulary: initial?.vocabulary?.length ? initial.vocabulary : [{ chinese: "", pinyin: "", english: "" }],
    sentences: initial?.sentences?.length
      ? initial.sentences
      : [{ speaker: "交換生", chinese: "", pinyin: "", english: "" }],
    order: initial?.order ?? initial?.level ?? 1,
    isPublished: initial?.isPublished ?? true,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/chinese-categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories || []);
        if (!value.categoryId && data.categories?.[0]) {
          setValue((v) => ({ ...v, categoryId: data.categories[0].id }));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateVocab(i: number, patch: Partial<Vocabulary>) {
    setValue((v) => {
      const vocabulary = [...v.vocabulary];
      const current = vocabulary[i] ?? { chinese: "", pinyin: "", english: "" };
      vocabulary[i] = { ...current, ...patch };
      return { ...v, vocabulary };
    });
  }

  function updateSentence(i: number, patch: Partial<Sentence>) {
    setValue((v) => {
      const sentences = [...v.sentences];
      const current = sentences[i] ?? { speaker: "", chinese: "", pinyin: "", english: "" };
      sentences[i] = { ...current, ...patch };
      return { ...v, sentences };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const result = await onSubmit(value);
    setSaving(false);
    if (result.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      setTimeout(() => router.push("/admin/chinese"), 600);
    } else {
      setStatus({ type: "error", text: result.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  const inputClass =
    "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <StatusBanner status={status} />

      {isNew && (
        <div>
          <label className="mb-1 block text-sm font-medium">關卡代碼（僅英數字與 -，之後不能修改）</label>
          <input
            required
            placeholder="例如：language-adaptation-5"
            value={value.id}
            onChange={(e) => setValue({ ...value, id: e.target.value })}
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">分類</label>
          <select
            required
            value={value.categoryId}
            onChange={(e) => setValue({ ...value, categoryId: e.target.value })}
            className={inputClass}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameZh}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">關卡編號</label>
          <input
            required
            type="number"
            min={1}
            value={value.level}
            onChange={(e) => setValue({ ...value, level: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">主題名稱（中文）</label>
        <input
          required
          placeholder="例如：飲料、買東西、問路"
          value={value.titleZh}
          onChange={(e) => setValue({ ...value, titleZh: e.target.value })}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">主題名稱（英文，選填）</label>
        <input value={value.titleEn} onChange={(e) => setValue({ ...value, titleEn: e.target.value })} className={inputClass} />
      </div>

      <ImageUploader value={value.image} onChange={(url) => setValue({ ...value, image: url })} label="封面圖片（選填）" />

      <div className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
        <p className="mb-3 text-sm font-medium">飲料插圖設定</p>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={value.drink.liquid}
            onChange={(e) => setValue({ ...value, drink: { ...value.drink, liquid: e.target.value as Drink["liquid"] } })}
            className={inputClass}
          >
            {LIQUID_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={value.drink.ice} onChange={(e) => setValue({ ...value, drink: { ...value.drink, ice: e.target.checked } })} />
              加冰
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={value.drink.foam} onChange={(e) => setValue({ ...value, drink: { ...value.drink, foam: e.target.checked } })} />
              奶泡
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={value.drink.straw} onChange={(e) => setValue({ ...value, drink: { ...value.drink, straw: e.target.checked } })} />
              吸管
            </label>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">中文詞彙</p>
          <button
            type="button"
            onClick={() => setValue({ ...value, vocabulary: [...value.vocabulary, { chinese: "", pinyin: "", english: "" }] })}
            className="flex items-center gap-1 text-xs text-transit-600 dark:text-transit-300"
          >
            <Plus size={14} />
            新增詞彙
          </button>
        </div>
        <div className="space-y-2">
          {value.vocabulary.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input placeholder="中文詞彙" value={v.chinese} onChange={(e) => updateVocab(i, { chinese: e.target.value })} className={inputClass} />
              <input placeholder="羅馬拼音" value={v.pinyin} onChange={(e) => updateVocab(i, { pinyin: e.target.value })} className={inputClass} />
              <input placeholder="英文" value={v.english} onChange={(e) => updateVocab(i, { english: e.target.value })} className={inputClass} />
              <button
                type="button"
                onClick={() => setValue({ ...value, vocabulary: value.vocabulary.filter((_, idx) => idx !== i) })}
                className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">例句對話</p>
          <button
            type="button"
            onClick={() =>
              setValue({ ...value, sentences: [...value.sentences, { speaker: "交換生", chinese: "", pinyin: "", english: "" }] })
            }
            className="flex items-center gap-1 text-xs text-transit-600 dark:text-transit-300"
          >
            <Plus size={14} />
            新增例句
          </button>
        </div>
        <div className="space-y-2">
          {value.sentences.map((s, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_1fr_1fr_auto] items-center gap-2">
              <input placeholder="說話者" value={s.speaker} onChange={(e) => updateSentence(i, { speaker: e.target.value })} className={inputClass} />
              <input placeholder="中文例句" value={s.chinese} onChange={(e) => updateSentence(i, { chinese: e.target.value })} className={inputClass} />
              <input placeholder="例句羅馬拼音" value={s.pinyin} onChange={(e) => updateSentence(i, { pinyin: e.target.value })} className={inputClass} />
              <input placeholder="英文例句" value={s.english} onChange={(e) => updateSentence(i, { english: e.target.value })} className={inputClass} />
              <button
                type="button"
                onClick={() => setValue({ ...value, sentences: value.sentences.filter((_, idx) => idx !== i) })}
                className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">排序（同分類內數字越小越前面）</label>
        <input
          type="number"
          value={value.order}
          onChange={(e) => setValue({ ...value, order: Number(e.target.value) })}
          className="w-32 rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.isPublished} onChange={(e) => setValue({ ...value, isPublished: e.target.checked })} />
        發布
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60">
          {saving ? "儲存中…" : submitLabel}
        </button>
        <button type="button" onClick={() => router.push("/admin/chinese")} className="rounded-lg border border-ink-100 dark:border-ink-800 px-5 py-2 text-sm transition hover:border-transit-400">
          取消
        </button>
      </div>
    </form>
  );
}
