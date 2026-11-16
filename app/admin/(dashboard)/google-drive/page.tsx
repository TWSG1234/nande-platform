"use client";

import { useEffect, useState } from "react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { driveMessage } from "@/lib/googleDriveMessages";

type Summary = {
  mode: "off" | "misconfigured" | "on";
  missing: string[];
  tableMissing: boolean;
  redirectUri: string | null;
  folderIdTail: string | null;
  authorized: boolean;
  status: string | null;
  accountEmail: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

export default function GoogleDrivePage() {
  const [s, setS] = useState<Summary | null>(null);
  const [msg, setMsg] = useState<StatusMessage>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/google-drive/status", { cache: "no-store" });
    if (r.ok) setS(await r.json());
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("result") === "ok") setMsg({ type: "success", text: "授權成功！之後審核通過的投稿照片會存進指定的 Google Drive 資料夾。" });
    else if (q.get("error")) setMsg({ type: "error", text: driveMessage(q.get("error")) });
    if (q.get("result") || q.get("error")) window.history.replaceState(null, "", window.location.pathname);
    load();
  }, []);

  async function post(url: string, okText: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch(url, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? { type: "success", text: okText + (d.folderName ? `（資料夾：${d.folderName}）` : "") } : { type: "error", text: d.error || "操作失敗。" });
    load();
  }

  if (!s) return <p className="p-6 text-sm text-ink-400">載入中…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <h1 className="text-xl font-bold">☁️ Google Drive 授權</h1>
      <p className="text-sm text-ink-400">學生投稿照片「審核通過」時，會用你授權的個人 Gmail 存進指定的 Google Drive 資料夾。</p>
      <StatusBanner status={msg} />

      {s.mode === "off" && <p className="rounded-lg border p-3 text-sm">尚未設定 Google OAuth 環境變數，目前通過的照片不會上傳到 Drive（審核仍可正常進行）。</p>}
      {s.mode === "misconfigured" && (
        <p className="rounded-lg border border-red-300 p-3 text-sm">環境變數不齊全，缺少：{s.missing.join("、")}。補齊並重新部署後才能授權；在此之前「通過」投稿會被擋下並顯示錯誤。</p>
      )}
      {s.tableMissing && <p className="rounded-lg border border-red-300 p-3 text-sm">{driveMessage("DRIVE_TABLE_MISSING")}</p>}

      {s.mode === "on" && !s.tableMissing && (
        <div className="space-y-3 rounded-xl border p-4 text-sm">
          <div>狀態：<b>{s.authorized ? "✅ 已授權" : s.status === "revoked" ? "⚠️ 授權已失效，請重新授權" : "尚未授權"}</b></div>
          {s.accountEmail && <div>授權帳號：{s.accountEmail}</div>}
          {s.connectedAt && <div>授權時間：{new Date(s.connectedAt).toLocaleString("zh-TW")}</div>}
          {s.folderIdTail && <div>目標資料夾 ID：{s.folderIdTail}（沿用原本的投稿資料夾）</div>}
          {s.lastError && !s.authorized && <div className="text-red-600">最近錯誤：{driveMessage(s.lastError)}</div>}
          <div className="flex flex-wrap gap-2 pt-2">
            <a href="/api/admin/google-drive/authorize" className="rounded-lg bg-transit-500 px-4 py-2 text-white">{s.authorized ? "重新授權" : "授權 Google Drive"}</a>
            {s.authorized && (
              <>
                <button disabled={busy} onClick={() => post("/api/admin/google-drive/test", "連線正常")} className="rounded-lg border px-4 py-2">檢查連線</button>
                <button
                  disabled={busy}
                  onClick={() => confirm("確定中斷 Google Drive 連線？已上傳的檔案與投稿紀錄不受影響。") && post("/api/admin/google-drive/disconnect", "已中斷連線")}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-600"
                >
                  中斷連線
                </button>
              </>
            )}
          </div>
          {s.redirectUri && <p className="pt-2 text-xs text-ink-400">Google Cloud 需登記的 Redirect URI：{s.redirectUri}</p>}
        </div>
      )}
    </div>
  );
}
