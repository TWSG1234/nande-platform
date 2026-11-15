"use client";

import ChineseForm, { ChineseFormValue } from "@/components/admin/ChineseForm";

export default function NewChinesePage() {
  async function handleSubmit(value: ChineseFormValue) {
    const res = await fetch("/api/admin/chinese-levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true };
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">新增中文學習關卡</h1>
      <div className="mt-6">
        <ChineseForm isNew onSubmit={handleSubmit} submitLabel="新增" />
      </div>
    </div>
  );
}
