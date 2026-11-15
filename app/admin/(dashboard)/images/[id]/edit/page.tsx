"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import OfficialImageForm, { OfficialImageFormValue } from "@/components/admin/OfficialImageForm";

export default function EditOfficialImagePage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<OfficialImageFormValue | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/official-images/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.image) {
          setNotFound(true);
          return;
        }
        setInitial({ ...data.image, usage: data.image.usage || "" });
      });
  }, [params.id]);

  async function handleSubmit(value: OfficialImageFormValue) {
    const res = await fetch(`/api/admin/official-images/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true };
  }

  if (notFound) return <p className="text-sm text-ink-400">找不到這張圖片。</p>;
  if (!initial) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">編輯｜{initial.title}</h1>
      <div className="mt-6">
        <OfficialImageForm initial={initial} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
