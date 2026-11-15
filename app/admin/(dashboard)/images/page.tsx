"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ImageIcon, ClipboardCheck, MessageCircle } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type OfficialImage = {
  id: string;
  url: string;
  title: string;
  category: string;
  usage: string | null;
  isActive: boolean;
  createdAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  home: "首頁",
  campus: "校園座標",
  life: "生活座標",
  chinese: "中文學習",
  calendar: "台灣行事曆",
  characters: "IP角色",
  about: "關於我們",
  other: "其他",
};

export default function AdminImagesPage() {
  const [images, setImages] = useState<OfficialImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [pendingCount, setPendingCount] = useState(0);

  async function load() {
    setLoading(true);
    const [imgRes, subRes] = await Promise.all([
      fetch("/api/admin/official-images"),
      fetch("/api/admin/uploads"),
    ]);
    const imgData = await imgRes.json();
    const subData = await subRes.json();
    if (imgRes.ok) setImages(imgData.images);
    if (subRes.ok) {
      setPendingCount(subData.submissions.filter((s: { status: string }) => s.status === "pending").length);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(img: OfficialImage) {
    const res = await fetch(`/api/admin/official-images/${img.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...img, isActive: !img.isActive }),
    });
    if (res.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
      load();
    } else {
      setStatus({ type: "error", text: "操作失敗，請稍後再試一次。" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這張圖片嗎？刪除後無法復原。")) return;
    const res = await fetch(`/api/admin/official-images/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus({ type: "success", text: "刪除成功！" });
      load();
    } else {
      setStatus({ type: "error", text: "刪除失敗，請稍後再試一次。" });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">🖼️ 圖片管理</h1>
          <p className="mt-1 text-sm text-ink-400">官方圖片庫，以及使用者照片投稿的審核。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/images/comments"
            className="flex items-center gap-1.5 rounded-lg border border-ink-100 dark:border-ink-800 px-4 py-2 text-sm font-medium transition hover:border-transit-400"
          >
            <MessageCircle size={16} />
            留言管理
          </Link>
          <Link
            href="/admin/images/submissions"
            className="flex items-center gap-1.5 rounded-lg border border-ink-100 dark:border-ink-800 px-4 py-2 text-sm font-medium transition hover:border-transit-400"
          >
            <ClipboardCheck size={16} />
            投稿審核
            {pendingCount > 0 && (
              <span className="rounded-full bg-lantern-500 px-1.5 text-xs text-white">{pendingCount}</span>
            )}
          </Link>
          <Link
            href="/admin/images/new"
            className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600"
          >
            <Plus size={16} />
            新增官方圖片
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
              <div className="h-36 w-full bg-ink-50 dark:bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.title} className="h-full w-full object-cover" />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{img.title}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {CATEGORY_LABEL[img.category] || img.category}
                  {img.usage ? ` · ${img.usage}` : ""}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(img)}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      img.isActive ? "bg-green-500/10 text-green-600 dark:text-green-300" : "bg-ink-100 dark:bg-white/10 text-ink-400"
                    }`}
                  >
                    {img.isActive ? "啟用中" : "已停用"}
                  </button>
                  <Link href={`/admin/images/${img.id}/edit`} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-50 dark:hover:bg-white/5">
                    <Pencil size={15} />
                  </Link>
                  <button onClick={() => handleDelete(img.id)} className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/10">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {images.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-10 text-center">
              <ImageIcon size={28} className="mx-auto text-ink-400" />
              <p className="mt-3 text-sm text-ink-400">還沒有任何官方圖片，點右上角「新增官方圖片」開始吧。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
