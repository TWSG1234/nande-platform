"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Character = { id: string; name: string; image: string; introZh: string; isVisible: boolean; order: number };

export default function AdminCharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/characters");
    const data = await res.json();
    if (res.ok) setCharacters(data.characters);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleVisible(c: Character) {
    const res = await fetch(`/api/admin/characters/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, isVisible: !c.isVisible }),
    });
    if (res.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      load();
    } else {
      setStatus({ type: "error", text: "操作失敗，請稍後再試一次。" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這筆資料嗎？刪除後無法復原。")) return;
    const res = await fetch(`/api/admin/characters/${id}`, { method: "DELETE" });
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
        <h1 className="font-display text-2xl font-bold">IP角色管理</h1>
        <Link href="/admin/characters/new" className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600">
          <Plus size={16} />
          新增角色
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-400">
        這裡管理的是「角色圖鑑」頁面。首頁最上方的 3 隻角色因為版面已經特別調校過，維持原本設計、不透過這裡管理。
      </p>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {characters.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt={c.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="mt-0.5 truncate text-sm text-ink-400">{c.introZh}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => toggleVisible(c)}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    c.isVisible ? "bg-green-500/10 text-green-600 dark:text-green-300" : "bg-ink-100 dark:bg-white/10 text-ink-400"
                  }`}
                >
                  {c.isVisible ? "顯示" : "隱藏"}
                </button>
                <Link href={`/admin/characters/${c.id}/edit`} className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 dark:hover:bg-white/5">
                  <Pencil size={16} />
                </Link>
                <button onClick={() => handleDelete(c.id)} className="rounded-lg p-2 text-red-400 transition hover:bg-red-500/10">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {characters.length === 0 && (
            <p className="col-span-2 rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6 text-center text-sm text-ink-400">
              目前還沒有任何角色，點右上角「新增角色」開始吧。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
