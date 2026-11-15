"use client";

import CalendarForm, { CalendarFormValue } from "@/components/admin/CalendarForm";

export default function NewCalendarPage() {
  async function handleSubmit(value: CalendarFormValue) {
    const res = await fetch("/api/admin/calendar", {
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
      <h1 className="font-display text-2xl font-bold">新增節日</h1>
      <div className="mt-6">
        <CalendarForm onSubmit={handleSubmit} submitLabel="新增" />
      </div>
    </div>
  );
}
