"use client";

import { EnglishSource } from "@/lib/translationService";

export type BilingualValue = { zh: string; en: string; source: EnglishSource };

/**
 * 一組「中文／English」輸入框，用在所有需要雙語支援的後台編輯表單。
 *
 * 目前沒有任何自動翻譯功能——管理員自己填中文、自己填英文。
 * - English 欄位是空的時候，儲存時後端會暫時把中文複製一份過去，避免英文
 *   欄位整個空白（不是翻譯），畫面上會提示「英文預設與中文相同，可自行修改」。
 * - 管理員在 English 框裡打字 → 標記這個欄位是「手動輸入」，之後中文再修改
 *   也不會覆蓋這裡的英文。
 */
export default function BilingualField({
  labelZh,
  labelEn,
  value,
  onChange,
  multiline = false,
  required = false,
}: {
  labelZh: string;
  labelEn: string;
  value: BilingualValue;
  onChange: (next: BilingualValue) => void;
  multiline?: boolean;
  required?: boolean;
}) {
  const inputClass =
    "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";
  const Field = multiline ? "textarea" : "input";
  const fieldProps = multiline ? { rows: 3 } : {};

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium">{labelZh}</label>
        <Field
          required={required}
          value={value.zh}
          onChange={(e) => onChange({ ...value, zh: e.target.value })}
          className={inputClass}
          {...fieldProps}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{labelEn}</label>
        <Field
          value={value.en}
          onChange={(e) => onChange({ ...value, en: e.target.value, source: "MANUAL" })}
          className={inputClass}
          {...fieldProps}
        />
        {value.source === "AUTO" && (
          <p className="mt-1 text-xs text-ink-400">英文預設與中文相同，可自行修改。</p>
        )}
      </div>
    </div>
  );
}
