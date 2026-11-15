"use client";

import { useEffect, useState } from "react";
import CampusForm, { CampusFormValue } from "@/components/admin/CampusForm";

export default function NewCampusPage() {
  const [pre, setPre] = useState<string | null>(null);
  useEffect(() => {
    setPre(new URLSearchParams(window.location.search).get("category") || "");
  }, []);

  async function handleSubmit(value: CampusFormValue) {
    const res = await fetch("/api/admin/campus", {
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
      <h1 className="font-display text-2xl font-bold">新增校園座標項目</h1>
      <div className="mt-6">
        {pre === null ? <p className="text-sm text-ink-400">載入中…</p> : <CampusForm isNew initial={pre ? { category: pre } : undefined} onSubmit={handleSubmit} submitLabel="新增" />}
      </div>
    </div>
  );
}
