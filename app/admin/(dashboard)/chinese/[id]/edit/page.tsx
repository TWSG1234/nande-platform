"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChineseForm, { ChineseFormValue } from "@/components/admin/ChineseForm";

export default function EditChinesePage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<ChineseFormValue | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/chinese-levels/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.level) {
          setNotFound(true);
          return;
        }
        setInitial(data.level);
      });
  }, [params.id]);

  async function handleSubmit(value: ChineseFormValue) {
    const res = await fetch(`/api/admin/chinese-levels/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true };
  }

  if (notFound) return <p className="text-sm text-ink-400">找不到這個關卡。</p>;
  if (!initial) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">編輯｜{initial.titleZh}</h1>
      <div className="mt-6">
        <ChineseForm initial={initial} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
