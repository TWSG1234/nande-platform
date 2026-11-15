"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, CheckCircle2, X, Megaphone } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function PhotoSubmitModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [nickname, setNickname] = useState("");
  const [caption, setCaption] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  // 投稿前想換掉／拿掉已選的照片：只清除本機選取的檔案與預覽（還沒上傳到伺服器）
  function handleRemoveSelected() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError(t("photo_modal_err_no_file"));
      return;
    }
    if (!title.trim()) {
      setError(t("photo_modal_err_no_title"));
      return;
    }
    if (!agreed) {
      setError(t("photo_modal_err_no_agree"));
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("nickname", nickname);
      formData.append("caption", caption);

      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("photo_modal_err_generic"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("photo_modal_err_network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card dark:bg-canvas-darkcard p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-300">
              <CheckCircle2 size={32} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold">{t("photo_modal_success_title")}</h2>
            <p className="mt-2 text-sm text-ink-400">{t("photo_modal_success_body")}</p>
            <button onClick={onClose} className="mt-6 rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600">
              {t("photo_modal_ok")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{t("photo_modal_title")}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-white/5 text-ink-400 transition hover:border-transit-400"
                >
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="preview" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    <>
                      <span className="flex gap-3">
                        <Camera size={22} />
                        <ImagePlus size={22} />
                      </span>
                      <span className="text-sm">{t("photo_modal_tap_to_add")}</span>
                    </>
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  capture="environment"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                {previewUrl && (
                  <button type="button" onClick={handleRemoveSelected} data-testid="photo-remove-selected" className="mt-2 text-xs font-medium text-red-500 underline">
                    {t("photo_modal_remove")}
                  </button>
                )}
                <p className="mt-1 text-xs text-ink-400">{t("photo_modal_support")}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t("photo_modal_title_label")}</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t("photo_modal_nickname_label")}</label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t("photo_modal_caption_label")}</label>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
                />
              </div>

              {/* 投稿須知 —— 必須在上傳之前就看得到，所以放在表單裡、送出按鈕之前 */}
              <div className="rounded-xl border border-lantern-500/30 bg-lantern-500/5 p-4">
                <p className="flex items-center gap-1.5 font-medium text-ink-900 dark:text-white">
                  <Megaphone size={15} /> {t("photo_modal_guidelines_title")}
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-ink-400 leading-relaxed">
                  <li>{t("photo_modal_guideline_1")}</li>
                  <li>{t("photo_modal_guideline_2")}</li>
                  <li>{t("photo_modal_guideline_3")}</li>
                  <li>{t("photo_modal_guideline_4")}</li>
                  <li>{t("photo_modal_guideline_5")}</li>
                </ul>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t("photo_modal_agree")}</span>
              </label>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-transit-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60"
              >
                {submitting ? t("photo_modal_submitting") : t("photo_modal_submit")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
