"use client";

import { useEffect, useState } from "react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Settings = {
  siteNameZh: string;
  siteNameEn: string;
  subtitleZh: string;
  subtitleEn: string;
  contactInfo: string;
};

export default function AdminSettingsPage() {
  const [value, setValue] = useState<Settings | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setValue(data.settings));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    setSaving(false);
    if (res.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
    } else {
      setStatus({ type: "error", text: "儲存失敗，請稍後再試一次。" });
    }
  }

  if (!value) return <p className="text-sm text-ink-400">載入中…</p>;

  const inputClass =
    "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">⚙️ 網站設定</h1>
      <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-5">
        <StatusBanner status={status} />

        <div>
          <label className="mb-1 block text-sm font-medium">網站名稱（中文）</label>
          <input value={value.siteNameZh} onChange={(e) => setValue({ ...value, siteNameZh: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">網站名稱（英文）</label>
          <input value={value.siteNameEn} onChange={(e) => setValue({ ...value, siteNameEn: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">首頁副標題（中文）</label>
          <input value={value.subtitleZh} onChange={(e) => setValue({ ...value, subtitleZh: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">首頁副標題（英文）</label>
          <input value={value.subtitleEn} onChange={(e) => setValue({ ...value, subtitleEn: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">聯絡資訊</label>
          <textarea rows={3} value={value.contactInfo} onChange={(e) => setValue({ ...value, contactInfo: e.target.value })} className={inputClass} />
        </div>

        <p className="text-xs text-ink-400">
          這裡的設定目前存進資料庫了；首頁實際套用這些文字需要另外接線（下一輪工作），暫時不會馬上改變首頁畫面。
        </p>

        <button type="submit" disabled={saving} className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60">
          {saving ? "儲存中…" : "儲存"}
        </button>
      </form>
    </div>
  );
}
