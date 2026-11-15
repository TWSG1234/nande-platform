"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type CalendarEvent = {
  id: string;
  date: string;
  nameZh: string;
  isHoliday: boolean;
  isOfficial: boolean;
  isPublished: boolean;
  imageUrl?: string | null;
};

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/calendar");
    const data = await res.json();
    if (res.ok) setEvents(data.events);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這筆資料嗎？刪除後無法復原。")) return;
    const res = await fetch(`/api/admin/calendar/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus({ type: "success", text: "刪除成功！" });
      load();
    } else {
      setStatus({ type: "error", text: "刪除失敗，請稍後再試一次。" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">台灣行事曆管理</h1>
        <Link href="/admin/calendar/new" className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600">
          <Plus size={16} />
          新增節日
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-400">
        標示「官方」的節日新增或修改時，系統會要求填寫官方資料來源，避免出現沒有依據的假日資訊。
      </p>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 dark:border-ink-800 text-ink-400">
              <tr>
                <th className="px-4 py-2 font-medium">日期</th>
                <th className="px-4 py-2 font-medium">節日</th>
                <th className="px-4 py-2 font-medium">放假</th>
                <th className="px-4 py-2 font-medium">來源</th>
                <th className="px-4 py-2 font-medium">狀態</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0">
                  <td className="px-4 py-2">{e.date}</td>
                  <td className="px-4 py-2">
                    {e.nameZh}
                    {e.imageUrl && <span className="ml-2 rounded-full bg-ink-100 dark:bg-white/10 px-2 py-0.5 text-xs text-ink-400">有小圖</span>}
                  </td>
                  <td className="px-4 py-2">{e.isHoliday ? "是" : "否"}</td>
                  <td className="px-4 py-2">
                    {e.isOfficial ? (
                      <span className="rounded-full bg-transit-500/10 px-2 py-0.5 text-xs text-transit-600 dark:text-transit-300">官方</span>
                    ) : (
                      <span className="rounded-full bg-ink-100 dark:bg-white/10 px-2 py-0.5 text-xs text-ink-400">自訂</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{e.isPublished ? "顯示中" : "已隱藏"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/calendar/${e.id}/edit`} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-50 dark:hover:bg-white/5">
                        <Pencil size={15} />
                      </Link>
                      <button onClick={() => handleDelete(e.id)} className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/10">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && <p className="p-6 text-center text-sm text-ink-400">目前還沒有任何行事曆資料。</p>}
        </div>
      )}
    </div>
  );
}
