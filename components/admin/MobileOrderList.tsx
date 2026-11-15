"use client";

import { useState } from "react";
import { EyeOff, Eye, Save } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

export type MobileOrderItem = {
  id: string;
  label: string; // 顯示用的中文標題
  mobileOrder: number | null;
  mobileHidden: boolean;
  desktopOrder: number;
};

export default function MobileOrderList({
  items,
  savePath, // (id) => API 路徑，例如 (id) => `/api/admin/campus/${id}/mobile`
  editHref, // (id) => 真正編輯內容文字的頁面連結，例如 (id) => `/admin/campus/${id}/edit`
}: {
  items: MobileOrderItem[];
  savePath: (id: string) => string;
  editHref: (id: string) => string;
}) {
  const [rows, setRows] = useState(items);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function update(id: string, patch: Partial<MobileOrderItem>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSave(row: MobileOrderItem) {
    setSavingId(row.id);
    setStatus(null);
    const res = await fetch(savePath(row.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileOrder: row.mobileOrder, mobileHidden: row.mobileHidden }),
    });
    setSavingId(null);
    if (res.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
    } else {
      setStatus({ type: "error", text: "儲存失敗，請稍後再試一次。" });
    }
  }

  return (
    <div>
      <div className="mb-4">
        <StatusBanner status={status} />
      </div>
      <div className="space-y-2">
        {[...rows]
          .sort((a, b) => (a.mobileOrder ?? a.desktopOrder) - (b.mobileOrder ?? b.desktopOrder))
          .map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <a href={editHref(row.id)} className="text-xs text-transit-600 dark:text-transit-300 hover:underline">
                  編輯內容文字 →
                </a>
              </div>

              <div>
                <label className="mb-0.5 block text-[10px] text-ink-400">手機順序</label>
                <input
                  type="number"
                  placeholder={String(row.desktopOrder)}
                  value={row.mobileOrder ?? ""}
                  onChange={(e) => update(row.id, { mobileOrder: e.target.value === "" ? null : Number(e.target.value) })}
                  className="w-20 rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1 text-sm outline-none focus:border-transit-500"
                />
              </div>

              <button
                onClick={() => update(row.id, { mobileHidden: !row.mobileHidden })}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                  row.mobileHidden ? "bg-ink-100 dark:bg-white/10 text-ink-400" : "bg-green-500/10 text-green-600 dark:text-green-300"
                }`}
              >
                {row.mobileHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                {row.mobileHidden ? "手機隱藏" : "手機顯示"}
              </button>

              <button
                onClick={() => handleSave(row)}
                disabled={savingId === row.id}
                className="flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-transit-600 disabled:opacity-60"
              >
                <Save size={13} />
                {savingId === row.id ? "儲存中…" : "儲存"}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
