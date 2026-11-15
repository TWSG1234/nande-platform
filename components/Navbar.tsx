"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { useLanguage } from "@/context/LanguageContext";

// 「關於我們」規定永遠是導覽列最後一個項目——不是靠排列順序去維持，而是從
// 資料結構本身保證：一般項目都放進 otherNavItems，「關於我們」單獨定義成
// aboutNavItem，最後用陣列展開 [...otherNavItems, aboutNavItem] 組成。
// 以後如果要新增導覽項目，加進 otherNavItems 就好，「關於我們」永遠不會被
// 擠到中間，不需要每次手動調整順序。
const otherNavItems = [
  { href: "/", key: "nav_home" as const },
  { href: "/campus", key: "nav_campus" as const },
  { href: "/life", key: "nav_life" as const },
  { href: "/chinese", key: "nav_chinese" as const },
  { href: "/calendar", key: "nav_calendar" as const },
  { href: "/photo-submit", key: "nav_photo_submit" as const },
  { href: "/ip-characters", key: "nav_ip_characters" as const },
];
const aboutNavItem = { href: "/about", key: "nav_about" as const };

const navItems = [...otherNavItems, aboutNavItem];

export default function Navbar({ logoUrl, siteName }: { logoUrl?: string | null; siteName?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();
  const name = siteName || "南得遇見你";

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 dark:border-white/10 bg-navbar/85 dark:bg-canvas-dark/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* shrink-0：Logo／網站名稱永遠維持原本大小，絕對不能被中間導覽項目
            擠壓、縮小或換行——不管英文版導覽字串多長都一樣。 */}
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display font-bold text-lg text-transit-600 dark:text-transit-300">
          <Image
            src={logoUrl || "/images/brand/logo.png"}
            alt={name}
            width={640}
            height={622}
            className="h-10 w-auto shrink-0 object-contain"
            priority
          />
          <span className="hidden whitespace-nowrap sm:inline">{name}</span>
        </Link>

        {/* min-w-0 讓這個區塊可以在空間不夠時真的縮小（而不是把 Logo 擠走），
            xl 以下用較窄的 padding/間距，等畫面更寬（xl）才放大到原本的手感——
            這是「先縮導覽項目的間距，而不是縮 Logo」的具體做法。 */}
        <div className="hidden lg:flex min-w-0 flex-1 items-center justify-center gap-0.5 px-2 xl:gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "whitespace-nowrap rounded-full px-2 py-2 text-sm font-medium transition-colors xl:px-3.5",
                  active
                    ? "bg-transit-500/10 text-transit-600 dark:text-transit-300"
                    : "text-ink-600 dark:text-ink-100 hover:bg-ink-50 dark:hover:bg-white/5"
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
          <button
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full border border-ink-100 dark:border-white/10"
            onClick={() => setOpen((v) => !v)}
            aria-label="開啟選單"
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="lg:hidden border-t border-ink-100 dark:border-white/10 px-4 py-3 flex flex-col gap-1 bg-canvas-light dark:bg-canvas-dark animate-fade-up">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-ink-600 dark:text-ink-100 hover:bg-ink-50 dark:hover:bg-white/5"
            >
              {t(item.key)}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
