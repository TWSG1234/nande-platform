"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CalendarForm, { CalendarFormValue } from "@/components/admin/CalendarForm";

export default function EditCalendarPage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<CalendarFormValue | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/calendar/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.event) {
          setNotFound(true);
          return;
        }
        setInitial({
          ...data.event,
          originZh: data.event.originZh || "",
          originEn: data.event.originEn || "",
          sourceZh: data.event.sourceZh || "",
          sourceEn: data.event.sourceEn || "",
          noteZh: data.event.noteZh || "",
          noteEn: data.event.noteEn || "",
          imageUrl: data.event.imageUrl || "",
        });
      });
  }, [params.id]);

  async function handleSubmit(value: CalendarFormValue) {
    const res = await fetch(`/api/admin/calendar/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true };
  }

  if (notFound) return <p className="text-sm text-ink-400">找不到這筆節日資料。</p>;
  if (!initial) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">編輯｜{initial.nameZh}</h1>
      <div className="mt-6">
        <CalendarForm initial={initial} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
