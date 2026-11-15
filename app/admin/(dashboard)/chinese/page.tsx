"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Category = { id: string; nameZh: string; order: number };
type Level = {
  id: string;
  categoryId: string;
  level: number;
  titleZh: string;
  isPublished: boolean;
};

export default function AdminChinesePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);

  async function load() {
    setLoading(true);
    const [catRes, lvlRes] = await Promise.all([
      fetch("/api/admin/chinese-categories"),
      fetch("/api/admin/chinese-levels"),
    ]);
    const catData = await catRes.json();
    const lvlData = await lvlRes.json();
    if (catRes.ok) setCategories(catData.categories);
    if (lvlRes.ok) setLevels(lvlData.levels);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(lvl: Level) {
    const res = await fetch(`/api/admin/chinese-levels/${lvl.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lvl, isPublished: !lvl.isPublished }),
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
    if (!confirm("確定要刪除這個關卡嗎？刪除後無法復原。")) return;
    const res = await fetch(`/api/admin/chinese-levels/${id}`, { method: "DELETE" });
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
        <h1 className="font-display text-2xl font-bold">中文學習管理</h1>
        <Link href="/admin/chinese/new" className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600">
          <Plus size={16} />
          新增關卡
        </Link>
      </div>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">載入中…</p>
      ) : (
        categories
          .sort((a, b) => a.order - b.order)
          .map((cat) => {
            const catLevels = levels.filter((l) => l.categoryId === cat.id).sort((a, b) => a.level - b.level);
            return (
              <div key={cat.id} className="mt-6">
                <p className="mb-2 text-sm font-medium text-ink-400">{cat.nameZh}</p>
                <div className="space-y-2">
                  {catLevels.map((lvl) => (
                    <div key={lvl.id} className="flex items-center justify-between rounded-xl border border-ink-100 dark:border-ink-800 p-4">
                      <p className="font-medium">
                        第 {lvl.level} 關｜{lvl.titleZh}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => togglePublish(lvl)}
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            lvl.isPublished ? "bg-green-500/10 text-green-600 dark:text-green-300" : "bg-ink-100 dark:bg-white/10 text-ink-400"
                          }`}
                        >
                          {lvl.isPublished ? "已發布" : "未發布"}
                        </button>
                        <Link href={`/admin/chinese/${lvl.id}/edit`} className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 dark:hover:bg-white/5">
                          <Pencil size={16} />
                        </Link>
                        <button onClick={() => handleDelete(lvl.id)} className="rounded-lg p-2 text-red-400 transition hover:bg-red-500/10">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {catLevels.length === 0 && <p className="text-sm text-ink-400">目前這個分類還沒有關卡。</p>}
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}
