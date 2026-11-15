import Link from "next/link";
import {
  Smartphone,
  Home,
  MapPinned,
  Route,
  Languages,
  CalendarDays,
  Sparkles,
  Megaphone,
  FileText,
  Menu,
  Eye,
} from "lucide-react";

const SECTIONS = [
  { href: "/admin/mobile/home", icon: Home, title: "手機首頁", desc: "3 隻角色排列、動畫，以及首頁各區塊顯示", ready: true },
  { href: "/admin/mobile/campus", icon: MapPinned, title: "手機校園座標", desc: "手機版排列順序、顯示/隱藏", ready: true },
  { href: "/admin/mobile/life", icon: Route, title: "手機生活座標", desc: "手機版排列順序、顯示/隱藏", ready: true },
  { href: "/admin/mobile/chinese", icon: Languages, title: "手機中文學習", desc: "連到內容編輯（手機專屬排版尚未建立）", ready: false },
  { href: "/admin/mobile/calendar", icon: CalendarDays, title: "手機台灣行事曆", desc: "連到內容編輯（手機專屬排版尚未建立）", ready: false },
  { href: "/admin/mobile/characters", icon: Sparkles, title: "手機 IP角色", desc: "連到內容編輯（手機專屬排版尚未建立）", ready: false },
  { href: "/admin/mobile/announcements", icon: Megaphone, title: "手機公告", desc: "連到內容編輯（手機專屬排版尚未建立）", ready: false },
  { href: "/admin/mobile/about", icon: FileText, title: "手機關於我們", desc: "連到內容編輯（手機專屬排版尚未建立）", ready: false },
  { href: "/admin/mobile/nav", icon: Menu, title: "手機導覽列", desc: "目前導覽列桌面/手機共用，尚未可後台調整", ready: false },
  { href: "/admin/mobile/preview", icon: Eye, title: "手機介面預覽", desc: "用真正的手機尺寸嵌入預覽實際網站", ready: true },
];

export default function AdminMobileHubPage() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Smartphone size={22} className="text-transit-500" />
        <h1 className="font-display text-2xl font-bold">手機版管理</h1>
      </div>
      <p className="mt-1 text-sm text-ink-400">
        手機版內容跟桌面版共用同一份資料，這裡管理的是「手機版怎麼呈現」——排列順序、顯示/隱藏、間距與尺寸這類手機專屬的版面設定，不是另外一份內容。
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border border-ink-100 dark:border-ink-800 p-5 transition hover:border-transit-400"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-transit-500/10 text-transit-600 dark:text-transit-300">
                <s.icon size={18} />
              </span>
              {!s.ready && (
                <span className="rounded-full bg-ink-100 dark:bg-white/10 px-2 py-0.5 text-[10px] text-ink-400">尚未完整</span>
              )}
            </div>
            <p className="mt-3 font-medium">{s.title}</p>
            <p className="mt-1 text-xs text-ink-400">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
