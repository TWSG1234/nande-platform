"use client";

import { useSearchParams } from "next/navigation";
import AnnouncementForm, { AnnouncementFormValue } from "@/components/admin/AnnouncementForm";

export default function NewAnnouncementPage() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") === "holiday" ? "holiday" : "permanent";

  async function handleSubmit(value: AnnouncementFormValue) {
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    if (data.linkWarning) return { ok: false, error: `${data.linkWarning}（公告本身已建立，請回公告列表開啟「編輯」修正連結，不要重複新增。）` };
    return { ok: true };
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">{type === "holiday" ? "新增節假日公告" : "新增常駐公告"}</h1>
      <div className="mt-6">
        <AnnouncementForm initial={{ type }} onSubmit={handleSubmit} submitLabel="新增" />
      </div>
    </div>
  );
}
