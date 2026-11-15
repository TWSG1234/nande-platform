"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type Comment = { id: string; nickname: string; content: string; createdAt: string };

export default function CommentSection({ photoId, initialComments }: { photoId: string; initialComments: Comment[] }) {
  const { t, lang } = useLanguage();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || !content.trim()) {
      setError(t("comment_err_required"));
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("comment_err_generic"));
        return;
      }
      // 留言內容是使用者原文，不會被翻譯或修改——這裡直接把伺服器回傳的內容加進畫面。
      setComments((prev) => [...prev, data.comment]);
      setContent("");
    } catch {
      setError(t("comment_err_network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10">
      <h2 className="flex items-center gap-1.5 font-display text-lg font-bold">
        <MessageCircle size={18} /> {t("comment_section_title")}（{comments.length}）
      </h2>
      <p className="mt-1 text-xs text-ink-400">{t("comment_reminder")}</p>

      <div className="mt-4 space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-xl border border-ink-100 dark:border-white/10 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{c.nickname}</p>
              <p className="text-xs text-ink-400">{new Date(c.createdAt).toLocaleString(lang === "zh-TW" ? "zh-TW" : "en-US")}</p>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-600 dark:text-ink-100">{c.content}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-ink-400">{t("comment_empty")}</p>}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3 rounded-xl border border-ink-100 dark:border-white/10 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("comment_nickname_label")}</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("comment_content_label")}</label>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60"
        >
          {submitting ? t("comment_submitting") : t("comment_submit")}
        </button>
      </form>
    </div>
  );
}
