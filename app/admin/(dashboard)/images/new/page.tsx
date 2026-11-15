"use client";

import OfficialImageForm, { OfficialImageFormValue } from "@/components/admin/OfficialImageForm";

export default function NewOfficialImagePage() {
  async function handleSubmit(value: OfficialImageFormValue) {
    const res = await fetch("/api/admin/official-images", {
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
      <h1 className="font-display text-2xl font-bold">新增官方圖片</h1>
      <div className="mt-6">
        <OfficialImageForm onSubmit={handleSubmit} submitLabel="新增" />
      </div>
    </div>
  );
}
