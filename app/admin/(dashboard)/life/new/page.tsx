"use client";

import { useEffect, useState } from "react";
import LifeForm, { LifeFormValue } from "@/components/admin/LifeForm";

export default function NewLifePage() {
  const [pre, setPre] = useState<string | null>(null);
  useEffect(() => {
    setPre(new URLSearchParams(window.location.search).get("category") || "");
  }, []);

  async function handleSubmit(value: LifeFormValue) {
    const res = await fetch("/api/admin/life-items", {
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
      <h1 className="font-display text-2xl font-bold">新增生活座標項目</h1>
      <div className="mt-6">
        {pre === null ? <p className="text-sm text-ink-400">載入中…</p> : <LifeForm isNew initial={pre ? { categoryId: pre } : undefined} onSubmit={handleSubmit} submitLabel="新增" />}
      </div>
    </div>
  );
}
