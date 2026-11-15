"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ShieldOff, Trash2, Eye, ArrowLeft, Search, Pencil } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Submission = {
  id: string;
  previewUrl: string | null;
  title: string;
  titleEn: string;
  nickname: string | null;
  caption: string | null;
  captionEn: string | null;
  category: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  rejectionReason: string | null;
  rejectionNote: string | null;
};

const TABS: { key: "all" | Submission["status"]; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待審核" },
  { key: "approved", label: "已通過" },
  { key: "rejected", label: "已拒絕" },
];

const STATUS_LABEL: Record<Submission["status"], string> = {
  pending: "待審核",
  approved: "已通過",
  rejected: "已拒絕",
};

const REJECTION_REASONS = [
  "色情／裸露內容",
  "血腥／暴力內容",
  "侵犯隱私",
  "侵犯肖像權",
  "侵犯著作權",
  "違法或不適當內容",
  "與網站主題無關",
  "其他",
];

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<"all" | Submission["status"]>("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [preview, setPreview] = useState<Submission | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<Submission | null>(null);
  const [editForm, setEditForm] = useState({ title: "", titleEn: "", caption: "", captionEn: "" });
  const [savingContent, setSavingContent] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/uploads");
    const data = await res.json();
    if (res.ok) setSubmissions(data.submissions);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/uploads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus({ type: "success", text: "已通過這張投稿！" });
      setPreview(null);
      load();
    } else {
      setStatus({ type: "error", text: data.error || "操作失敗，請稍後再試一次。" });
    }
  }

  function openRejectDialog(s: Submission) {
    setReason(REJECTION_REASONS[0]);
    setNote("");
    setRejecting(s);
  }

  async function confirmReject() {
    if (!rejecting) return;
    const res = await fetch(`/api/admin/uploads/${rejecting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejectionReason: reason, rejectionNote: note || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus({ type: "success", text: "已駁回這張投稿。" });
      setRejecting(null);
      setPreview(null);
      load();
    } else {
      setStatus({ type: "error", text: data.error || "操作失敗，請稍後再試一次。" });
    }
  }

  function openEditDialog(s: Submission) {
    setEditForm({
      title: s.title || "",
      titleEn: s.titleEn || "",
      caption: s.caption || "",
      captionEn: s.captionEn || "",
    });
    setEditing(s);
  }

  async function saveContent(andApprove: boolean) {
    if (!editing) return;
    setSavingContent(true);
    const res = await fetch(`/api/admin/uploads/${editing.id}/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setSavingContent(false);
      setStatus({ type: "error", text: data.error || "儲存失敗，請稍後再試一次。" });
      return;
    }
    if (andApprove) {
      await handleApprove(editing.id);
    } else {
      setStatus({ type: "success", text: "內容已儲存！" });
      load();
    }
    setSavingContent(false);
    setEditing(null);
    setPreview(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這筆投稿嗎？刪除後無法復原。")) return;
    const res = await fetch(`/api/admin/uploads/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus({ type: "success", text: "刪除成功！" });
      setPreview(null);
      load();
    } else {
      setStatus({ type: "error", text: "刪除失敗，請稍後再試一次。" });
    }
  }

  const filtered = useMemo(() => {
    return submissions
      .filter((s) => tab === "all" || s.status === tab)
      .filter((s) => !query.trim() || s.title.toLowerCase().includes(query.trim().toLowerCase()));
  }, [submissions, tab, query]);

  return (
    <div>
      <Link href="/admin/images" className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 圖片管理
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">投稿審核</h1>
      <p className="mt-1 text-sm text-ink-400">只有按「通過投稿」的照片，才會被視為審核通過的內容。</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === t.key ? "bg-transit-500 text-white" : "border border-ink-100 dark:border-ink-800 text-ink-400"
            }`}
          >
            {t.label}
            {t.key !== "all" && `（${submissions.filter((s) => s.status === t.key).length}）`}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋照片名稱"
            className="rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none focus:border-transit-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
              <button onClick={() => setPreview(s)} className="block h-40 w-full bg-ink-50 dark:bg-white/5">
                {s.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.previewUrl} alt={s.title} className="h-full w-full object-cover" />
                )}
              </button>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      s.status === "approved"
                        ? "bg-green-500/10 text-green-600 dark:text-green-300"
                        : s.status === "rejected"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-ink-100 dark:bg-white/10 text-ink-400"
                    }`}
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                {s.nickname && <p className="mt-1 text-xs text-ink-400">投稿者：{s.nickname}</p>}
                {s.caption && <p className="mt-1 text-sm text-ink-400">{s.caption}</p>}
                <p className="mt-1 text-xs text-ink-400">{new Date(s.createdAt).toLocaleString("zh-TW")}</p>

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => setPreview(s)} className="rounded-lg border border-ink-100 dark:border-ink-800 p-1.5" title="查看">
                    <Eye size={15} />
                  </button>
                  <button onClick={() => openEditDialog(s)} className="rounded-lg border border-ink-100 dark:border-ink-800 p-1.5" title="編輯內容">
                    <Pencil size={15} />
                  </button>
                  {s.status !== "approved" && (
                    <button onClick={() => handleApprove(s.id)} className="rounded-lg bg-green-500/10 p-1.5 text-green-600 dark:text-green-300" title="通過投稿">
                      <Check size={15} />
                    </button>
                  )}
                  {s.status !== "rejected" && (
                    <button onClick={() => openRejectDialog(s)} className="rounded-lg bg-ink-100 dark:bg-white/10 p-1.5 text-ink-400" title="因違規而駁回">
                      <ShieldOff size={15} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(s.id)} className="rounded-lg bg-red-500/10 p-1.5 text-red-500" title="刪除投稿">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6 text-center text-sm text-ink-400">
              沒有符合條件的投稿。
            </p>
          )}
        </div>
      )}

      {/* 大圖預覽 */}
      {preview && !rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-full max-w-lg overflow-auto rounded-2xl bg-white dark:bg-canvas-darkcard p-4" onClick={(e) => e.stopPropagation()}>
            {preview.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.previewUrl} alt={preview.title} className="w-full rounded-xl object-cover" />
            )}
            <p className="mt-3 font-medium">{preview.title}</p>
            {preview.nickname && <p className="mt-1 text-sm text-ink-400">投稿者：{preview.nickname}</p>}
            {preview.caption && <p className="mt-1 text-sm text-ink-400">{preview.caption}</p>}
            <p className="mt-1 text-xs text-ink-400">
              投稿時間：{new Date(preview.createdAt).toLocaleString("zh-TW")} · 狀態：{STATUS_LABEL[preview.status]}
            </p>
            {preview.status === "rejected" && preview.rejectionReason && (
              <div className="mt-2 rounded-lg bg-red-500/5 p-2 text-xs text-red-500">
                <p>駁回原因：{preview.rejectionReason}</p>
                {preview.rejectionNote && <p className="mt-0.5">備註：{preview.rejectionNote}</p>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => openEditDialog(preview)} className="rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-1.5 text-sm">
                編輯內容
              </button>
              {preview.status !== "approved" && (
                <button onClick={() => handleApprove(preview.id)} className="rounded-lg bg-green-500/10 px-3 py-1.5 text-sm text-green-600 dark:text-green-300">
                  通過投稿
                </button>
              )}
              {preview.status !== "rejected" && (
                <button onClick={() => openRejectDialog(preview)} className="rounded-lg bg-ink-100 dark:bg-white/10 px-3 py-1.5 text-sm text-ink-400">
                  因違規而駁回
                </button>
              )}
              <button onClick={() => handleDelete(preview.id)} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-500">
                刪除投稿
              </button>
              <button onClick={() => setPreview(null)} className="rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-1.5 text-sm">
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 駁回原因選擇 */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRejecting(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-canvas-darkcard p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold">因違規而駁回｜{rejecting.title}</h2>

            <p className="mt-4 text-sm font-medium">駁回原因</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    reason === r ? "bg-transit-500 text-white" : "border border-ink-100 dark:border-ink-800 text-ink-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">管理員備註（選填）</label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：照片包含其他人的私人資訊。"
                className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={confirmReject} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600">
                確認駁回
              </button>
              <button onClick={() => setRejecting(null)} className="rounded-lg border border-ink-100 dark:border-ink-800 px-4 py-2 text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯內容——待審核、已通過的照片都可以用這裡改中英文標題/說明；
          單純改文字不會影響審核狀態，「通過」是另外一個按鈕。 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-canvas-darkcard p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold">編輯內容</h2>
            <p className="mt-1 text-xs text-ink-400">中文、英文可以只填一種，前台會自動用有內容的那個語言顯示。</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">中文標題</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">English Title</label>
                <input
                  value={editForm.titleEn}
                  onChange={(e) => setEditForm({ ...editForm, titleEn: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">中文說明</label>
                <textarea
                  rows={3}
                  value={editForm.caption}
                  onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">English Description</label>
                <textarea
                  rows={3}
                  value={editForm.captionEn}
                  onChange={(e) => setEditForm({ ...editForm, captionEn: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => saveContent(false)}
                disabled={savingContent}
                className="rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60"
              >
                {savingContent ? "儲存中…" : "儲存內容"}
              </button>
              {editing.status !== "approved" && (
                <button
                  onClick={() => saveContent(true)}
                  disabled={savingContent}
                  className="rounded-lg bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-300 disabled:opacity-60"
                >
                  儲存並通過
                </button>
              )}
              <button onClick={() => setEditing(null)} className="rounded-lg border border-ink-100 dark:border-ink-800 px-4 py-2 text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
