"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Menu, X, ExternalLink } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "🏠 後台首頁" },
  { href: "/admin/announcements", label: "📢 首頁公告" },
  { href: "/admin/campus", label: "🏫 校園座標" },
  { href: "/admin/life", label: "🌏 生活座標" },
  { href: "/admin/chinese-stages", label: "📚 中文學習" },
  { href: "/admin/calendar", label: "📅 台灣行事曆" },
  { href: "/admin/characters", label: "👤 IP角色" },
  { href: "/admin/ip-layout", label: "🧩 IP 角色版面" },
  { href: "/admin/images", label: "🖼️ 圖片管理" },
  { href: "/admin/about", label: "📄 關於我們" },
  { href: "/admin/appearance", label: "🎨 網站外觀" },
  { href: "/admin/mobile", label: "📱 手機版管理" },
  { href: "/admin/assistant", label: "🤖 威洛小助理設定" },
  { href: "/admin/assistant/types", label: "🎭 威洛問題類型" },
  { href: "/admin/assistant/questions", label: "🙋 威洛問題求助" },
  { href: "/admin/google-drive", label: "☁️ Google Drive 授權" },
  { href: "/admin/settings", label: "⚙️ 網站設定" },
];

export default function AdminShell({ children, siteName }: { children: React.ReactNode; siteName?: string }) {
  const name = siteName || "南得遇見你";
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex-1 space-y-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`block rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-transit-500/10 text-transit-600 dark:text-transit-300 font-medium"
                : "text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      {/* 唯一可以離開後台的連結——用新分頁開啟，所以管理員本身其實沒有真的
          離開 /admin，只是多開一個前台分頁。 */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-400 transition hover:bg-ink-50 dark:hover:bg-white/5"
      >
        <ExternalLink size={14} />
        查看前台網站
      </a>

      <button
        onClick={() => signOut({ callbackUrl: "/admin/login" })}
        className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-400 transition hover:bg-ink-50 dark:hover:bg-white/5"
      >
        🚪 登出
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* 電腦版：固定左側選單 */}
      <aside className="hidden w-60 shrink-0 border-r border-ink-100 dark:border-ink-800 md:flex md:flex-col">
        <div className="px-5 py-6">
          <p className="font-display text-lg font-bold">{name}</p>
          <p className="text-xs text-ink-400">管理後台</p>
        </div>
        {nav}
      </aside>

      {/* 手機版：可收合選單 */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 px-4 py-3 md:hidden">
          <p className="font-display font-bold">{name}後台</p>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-ink-400">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
        {mobileOpen && (
          <div className="border-b border-ink-100 dark:border-ink-800 py-2 md:hidden">{nav}</div>
        )}
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
