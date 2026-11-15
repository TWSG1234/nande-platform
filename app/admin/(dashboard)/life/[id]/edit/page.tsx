"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LifeForm, { LifeFormValue } from "@/components/admin/LifeForm";

export default function EditLifePage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<LifeFormValue | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/life-items/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.item) {
          setNotFound(true);
          return;
        }
        setInitial(data.item);
      });
  }, [params.id]);

  async function handleSubmit(value: LifeFormValue) {
    const res = await fetch(`/api/admin/life-items/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true };
  }

  if (notFound) return <p className="text-sm text-ink-400">找不到這筆資料。</p>;
  if (!initial) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">編輯｜{initial.titleZh}</h1>
      <div className="mt-6">
        <LifeForm initial={initial} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
