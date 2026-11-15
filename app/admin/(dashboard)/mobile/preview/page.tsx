"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

const PRESET_PATHS = [
  { label: "首頁", path: "/" },
  { label: "校園座標", path: "/campus" },
  { label: "生活座標", path: "/life" },
  { label: "中文學習", path: "/chinese" },
  { label: "台灣行事曆", path: "/calendar" },
  { label: "IP角色介紹", path: "/ip-characters" },
  { label: "照片投稿", path: "/photo-submit" },
  { label: "關於我們", path: "/about" },
];

export default function MobilePreviewPage() {
  const [path, setPath] = useState("/");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div>
      <Link href="/admin/mobile" className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 手機版管理
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">📱 手機介面預覽</h1>
      <p className="mt-1 text-sm text-ink-400">
        這是真正的網站頁面，用手機寬度的視窗嵌入顯示——不是示意圖。改了內容或手機版設定後，按「重新整理」就能看到最新結果。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PRESET_PATHS.map((p) => (
          <button
            key={p.path}
            onClick={() => setPath(p.path)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              path === p.path ? "bg-transit-500 text-white" : "border border-ink-100 dark:border-ink-800 text-ink-400"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex items-center gap-1 rounded-full border border-ink-100 dark:border-ink-800 px-3 py-1.5 text-xs text-ink-400 hover:border-transit-400"
        >
          <RefreshCw size={12} />
          重新整理
        </button>
      </div>

      <div className="mt-6 flex justify-center">
        {/* 390 x 844 = 螢幕最常見的手機直向尺寸之一（iPhone 12/13/14）。
            外框只是造型，裡面 iframe 載入的是網站本人，不是模擬畫面。 */}
        <div className="rounded-[2.5rem] border-[10px] border-ink-800 dark:border-white/20 bg-ink-800 dark:bg-white/20 shadow-soft">
          <div className="overflow-hidden rounded-[1.75rem] bg-white" style={{ width: 390, height: 844 }}>
            <iframe
              key={reloadKey}
              src={path}
              title="手機預覽"
              style={{ width: 390, height: 844, border: 0 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
