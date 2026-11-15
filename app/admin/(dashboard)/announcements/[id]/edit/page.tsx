"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AnnouncementForm, { AnnouncementFormValue } from "@/components/admin/AnnouncementForm";

export default function EditAnnouncementPage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<AnnouncementFormValue | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [linkReady, setLinkReady] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/announcements/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.announcement) {
          setNotFound(true);
          return;
        }
        setLinkReady(data.announcement.linkTableReady !== false);
        setInitial(data.announcement);
      });
  }, [params.id]);

  async function handleSubmit(value: AnnouncementFormValue) {
    const res = await fetch(`/api/admin/announcements/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, warning: data.linkWarning || undefined };
  }

  if (notFound) return <p className="text-sm text-ink-400">找不到這筆公告。</p>;
  if (!initial) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">編輯公告</h1>
      <div className="mt-6">
        <AnnouncementForm initial={initial} onSubmit={handleSubmit} submitLabel="儲存變更" linkTableReady={linkReady} />
      </div>
    </div>
  );
}
