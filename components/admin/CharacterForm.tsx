"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/admin/ImageUploader";
import BilingualField from "@/components/admin/BilingualField";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { EnglishSource } from "@/lib/translationService";

export type CharacterFormValue = {
  name: string;
  image: string | null;
  introZh: string;
  introEn: string;
  introEnSource: EnglishSource;
  positionZh: string;
  positionEn: string;
  positionEnSource: EnglishSource;
  personalityZh: string;
  personalityEn: string;
  personalityEnSource: EnglishSource;
  quoteZh: string;
  quoteEn: string;
  quoteEnSource: EnglishSource;
  conceptTitleZh: string;
  conceptTitleEn: string;
  conceptTitleEnSource: EnglishSource;
  dialogueEnabled: boolean;
  homePosition: "" | "characterA" | "characterB" | "characterC";
  backImage: string | null;
  backImageWidth: number | null;
  backImageHeight: number | null;
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
  order: number;
  isVisible: boolean;
};

const COLOR_FIELDS: { key: "bgColor" | "borderColor" | "textColor" | "accentColor"; label: string }[] = [
  { key: "bgColor", label: "卡片背景色（用卡牌圖底色的淺色版）" },
  { key: "borderColor", label: "框線色（用卡牌圖裡最深的代表色）" },
  { key: "textColor", label: "文字色" },
  { key: "accentColor", label: "其他裝飾色" },
];

export default function CharacterForm({
  initial,
  onSubmit,
  submitLabel = "儲存變更",
}: {
  initial?: Partial<CharacterFormValue>;
  onSubmit: (value: CharacterFormValue) => Promise<{ ok: boolean; error?: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<CharacterFormValue>({
    name: initial?.name || "",
    image: initial?.image ?? null,
    introZh: initial?.introZh || "",
    introEn: initial?.introEn || "",
    introEnSource: initial?.introEnSource || "AUTO",
    positionZh: initial?.positionZh || "",
    positionEn: initial?.positionEn || "",
    positionEnSource: initial?.positionEnSource || "AUTO",
    personalityZh: initial?.personalityZh || "",
    personalityEn: initial?.personalityEn || "",
    personalityEnSource: initial?.personalityEnSource || "AUTO",
    quoteZh: initial?.quoteZh || "",
    quoteEn: initial?.quoteEn || "",
    quoteEnSource: initial?.quoteEnSource || "AUTO",
    conceptTitleZh: initial?.conceptTitleZh || "",
    conceptTitleEn: initial?.conceptTitleEn || "",
    conceptTitleEnSource: initial?.conceptTitleEnSource || "AUTO",
    dialogueEnabled: initial?.dialogueEnabled ?? true,
    homePosition: initial?.homePosition || "",
    backImage: initial?.backImage ?? null,
    backImageWidth: initial?.backImageWidth ?? null,
    backImageHeight: initial?.backImageHeight ?? null,
    bgColor: initial?.bgColor || "#FFFFFF",
    borderColor: initial?.borderColor || "#84bed7",
    textColor: initial?.textColor || "#1B1B1B",
    accentColor: initial?.accentColor || "#2a6ea2",
    order: initial?.order ?? 0,
    isVisible: initial?.isVisible ?? true,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.image) {
      setStatus({ type: "error", text: "請先上傳角色圖片。" });
      return;
    }
    setSaving(true);
    setStatus(null);
    const result = await onSubmit(value);
    setSaving(false);
    if (result.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      setTimeout(() => router.push("/admin/characters"), 600);
    } else {
      setStatus({ type: "error", text: result.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <StatusBanner status={status} />

      <div>
        <label className="mb-1 block text-sm font-medium">角色名稱</label>
        <input
          required
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        />
      </div>

      <ImageUploader
        value={value.image}
        onChange={(url) => setValue({ ...value, image: url })}
        label="角色圖片／身分證正面照"
        required
        requiredReason="這張圖同時用在首頁角色與身分證正面，每個角色都必須有。要換成別張請按「更換圖片」。"
      />

      <div>
        <ImageUploader
          value={value.backImage}
          onChange={(url) => setValue((v) => ({ ...v, backImage: url, ...(url ? {} : { backImageWidth: null, backImageHeight: null }) }))}
          onDimensions={(w, h) => setValue((v) => ({ ...v, backImageWidth: w, backImageHeight: h }))}
          label="身分證背面卡牌圖"
        />
        <p className="mt-1 text-xs text-ink-400">
          會依照這張圖片本身的原始比例顯示在背面，不會被拉伸或裁切變形。
        </p>
      </div>

      <BilingualField
        labelZh="定位（中文）"
        labelEn="Position (English)"
        value={{ zh: value.positionZh, en: value.positionEn, source: value.positionEnSource }}
        onChange={(next) => setValue({ ...value, positionZh: next.zh, positionEn: next.en, positionEnSource: next.source })}
      />

      <BilingualField
        labelZh="個性（中文）"
        labelEn="Personality (English)"
        value={{ zh: value.personalityZh, en: value.personalityEn, source: value.personalityEnSource }}
        onChange={(next) =>
          setValue({ ...value, personalityZh: next.zh, personalityEn: next.en, personalityEnSource: next.source })
        }
      />

      <BilingualField
        labelZh="一句話（中文）"
        labelEn="Quote (English)"
        value={{ zh: value.quoteZh, en: value.quoteEn, source: value.quoteEnSource }}
        onChange={(next) => setValue({ ...value, quoteZh: next.zh, quoteEn: next.en, quoteEnSource: next.source })}
      />

      <BilingualField
        labelZh="設計理念標題（中文）"
        labelEn="Design Concept Title (English)"
        value={{ zh: value.conceptTitleZh, en: value.conceptTitleEn, source: value.conceptTitleEnSource }}
        onChange={(next) =>
          setValue({ ...value, conceptTitleZh: next.zh, conceptTitleEn: next.en, conceptTitleEnSource: next.source })
        }
      />

      <div>
        <label className="mb-1 block text-sm font-medium">首頁位置</label>
        <p className="mb-1.5 text-xs text-ink-400">
          指定這筆角色資料要對應到首頁的哪一個角色位置（跟角色圖片、對話框都是用這個設定連起來的，不是用排序或猜的）。同一個位置只能給一隻角色，指定後原本在那個位置的角色會被自動取消。
        </p>
        <select
          value={value.homePosition}
          onChange={(e) => setValue({ ...value, homePosition: e.target.value as CharacterFormValue["homePosition"] })}
          className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
        >
          <option value="">不連結首頁</option>
          <option value="characterA">首頁角色 1</option>
          <option value="characterB">首頁角色 2</option>
          <option value="characterC">首頁角色 3</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={value.dialogueEnabled} onChange={(e) => setValue({ ...value, dialogueEnabled: e.target.checked })} />
        首頁點擊這隻角色時顯示對話框
      </label>
      <p className="-mt-3 text-xs text-ink-400">
        關閉的話，使用者點擊角色就不會跳出對話框（角色本身的點擊彈跳動畫還是會有）。對話框實際要顯示的句子，存這筆角色新增之後，到編輯頁下方的「首頁對話回覆」管理，可以新增好幾句，每次點擊隨機抽一句。
      </p>

      <BilingualField
        labelZh="設計理念內容（中文）"
        labelEn="Design Concept Content (English)"
        multiline
        value={{ zh: value.introZh, en: value.introEn, source: value.introEnSource }}
        onChange={(next) => setValue({ ...value, introZh: next.zh, introEn: next.en, introEnSource: next.source })}
      />

      <div>
        <p className="mb-2 text-sm font-medium">身分證配色（從這隻角色的卡牌圖片萃取，不同角色可以各自不同）</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs text-ink-400">{f.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value[f.key]}
                  onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded border border-ink-100 dark:border-ink-800 bg-transparent"
                />
                <input
                  value={value[f.key]}
                  onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                />
              </div>
            </div>
          ))}
        </div>
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
        <input type="checkbox" checked={value.isVisible} onChange={(e) => setValue({ ...value, isVisible: e.target.checked })} />
        顯示於網站
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60">
          {saving ? "儲存中…" : submitLabel}
        </button>
        <button type="button" onClick={() => router.push("/admin/characters")} className="rounded-lg border border-ink-100 dark:border-ink-800 px-5 py-2 text-sm transition hover:border-transit-400">
          取消
        </button>
      </div>
    </form>
  );
}
