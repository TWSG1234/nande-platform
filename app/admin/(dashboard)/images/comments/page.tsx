"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type AdminComment = {
  id: string;
  nickname: string;
  content: string;
  createdAt: string;
  photo: { title: string };
};

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/comments");
    const data = await res.json();
    if (res.ok) setComments(data.comments);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這則留言嗎？刪除後公開頁面不會再顯示。")) return;
    const res = await fetch(`/api/admin/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus({ type: "success", text: "留言已刪除！" });
      load();
    } else {
      setStatus({ type: "error", text: "刪除失敗，請稍後再試一次。" });
    }
  }

  return (
    <div>
      <Link href="/admin/images" className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 圖片管理
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">留言管理</h1>
      <p className="mt-1 text-sm text-ink-400">刪除的留言會從公開頁面隱藏，但仍保留在資料庫紀錄裡。</p>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-4 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-400">所屬照片：{c.photo.title}</p>
                <p className="mt-1 text-sm font-medium">{c.nickname}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-600 dark:text-ink-100">{c.content}</p>
                <p className="mt-1 text-xs text-ink-400">{new Date(c.createdAt).toLocaleString("zh-TW")}</p>
              </div>
              <button onClick={() => handleDelete(c.id)} className="shrink-0 rounded-lg p-2 text-red-400 transition hover:bg-red-500/10">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6 text-center text-sm text-ink-400">
              目前沒有任何留言。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
