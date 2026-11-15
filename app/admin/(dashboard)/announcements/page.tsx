"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Announcement = {
  id: string;
  type: "permanent" | "holiday";
  titleZh: string;
  contentZh: string;
  isPublished: boolean;
  publishDate: string;
  updatedAt: string;
  order: number;
  startDate: string;
  endDate: string;
  relatedHoliday: string;
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/announcements");
    const data = await res.json();
    if (res.ok) setAnnouncements(data.announcements);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(a: Announcement) {
    const res = await fetch(`/api/admin/announcements/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...a, isPublished: !a.isPublished }),
    });
    if (res.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      load();
    } else {
      const data = await res.json();
      setStatus({ type: "error", text: data.error || "操作失敗，請稍後再試一次。" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這筆資料嗎？刪除後無法復原。")) return;
    const res = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus({ type: "success", text: "刪除成功！" });
      load();
    } else {
      setStatus({ type: "error", text: "刪除失敗，請稍後再試一次。" });
    }
  }

  const permanentList = announcements.filter((a) => a.type === "permanent");
  const holidayList = announcements.filter((a) => a.type === "holiday");

  function renderList(list: Announcement[], emptyText: string) {
    if (loading) return <p className="mt-4 text-sm text-ink-400">載入中…</p>;
    if (list.length === 0) {
      return (
        <p className="mt-4 rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6 text-center text-sm text-ink-400">
          {emptyText}
        </p>
      );
    }
    return (
      <div className="mt-4 space-y-3">
        {list.map((a) => (
          <div key={a.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.titleZh}</p>
                <p className="mt-1 truncate text-sm text-ink-400">{a.contentZh}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-400">
                  {a.type === "holiday" && (
                    <span>
                      期間：{a.startDate || "—"} ~ {a.endDate || "—"}
                      {a.relatedHoliday ? `（${a.relatedHoliday}）` : ""}
                    </span>
                  )}
                  <span>排序：{a.order}</span>
                  <span>最後修改：{new Date(a.updatedAt).toLocaleString("zh-TW")}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => togglePublish(a)}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    a.isPublished
                      ? "bg-green-500/10 text-green-600 dark:text-green-300"
                      : "bg-ink-100 dark:bg-white/10 text-ink-400"
                  }`}
                >
                  {a.isPublished ? "已發布" : "草稿"}
                </button>
                <Link
                  href={`/admin/announcements/${a.id}/edit`}
                  className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 dark:hover:bg-white/5"
                >
                  <Pencil size={16} />
                </Link>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="rounded-lg p-2 text-red-400 transition hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">首頁公告管理</h1>
      <p className="mt-1 text-sm text-ink-400">
        這裡管理的公告跟首頁輪播是同一份資料——常駐公告與節假日公告會同時顯示，不會互相蓋掉。
      </p>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {/* 常駐公告 */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold">📌 常駐公告</h2>
          <Link
            href="/admin/announcements/new?type=permanent"
            className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600"
          >
            <Plus size={16} />
            新增常駐公告
          </Link>
        </div>
        <p className="mt-1 text-xs text-ink-400">不需要日期，發布後會一直顯示，不會因為節假日公告出現而消失。</p>
        {renderList(permanentList, "目前還沒有常駐公告，點「新增常駐公告」開始吧。")}
      </div>

      {/* 節假日公告 */}
      <div className="mt-10 border-t border-ink-100 dark:border-ink-800 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold">🎉 節假日公告</h2>
          <Link
            href="/admin/announcements/new?type=holiday"
            className="flex items-center gap-1.5 rounded-lg bg-lantern-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-lantern-600"
          >
            <Plus size={16} />
            新增節假日公告
          </Link>
        </div>
        <p className="mt-1 text-xs text-ink-400">只有在設定的開始～結束日期之間才會顯示，跟常駐公告同時出現在輪播裡。</p>
        {renderList(holidayList, "目前還沒有節假日公告，點「新增節假日公告」開始吧。")}
      </div>
    </div>
  );
}
