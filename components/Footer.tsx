"use client";

import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function Footer({ siteName, logoUrl }: { siteName?: string; logoUrl?: string | null }) {
  const { t } = useLanguage();
  const name = siteName || "南得遇見你";

  const columns = [
    {
      title: t("footer_explore"),
      links: [
        { href: "/campus", label: t("nav_campus") },
        { href: "/life", label: t("nav_life") },
        { href: "/chinese", label: t("nav_chinese") },
        { href: "/calendar", label: t("nav_calendar") },
      ],
    },
    {
      title: t("footer_about"),
      links: [
        { href: "/about", label: t("footer_mission") },
        { href: "/about#privacy", label: t("footer_privacy") },
        { href: "/about#terms", label: t("footer_terms") },
        { href: "/about#contact", label: t("footer_contact") },
      ],
    },
  ];

  return (
    <footer className="border-t border-ink-100 dark:border-white/10 bg-footerbg dark:bg-canvas-darkcard mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2">
          <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display font-bold text-lg text-transit-600 dark:text-transit-300">
            <Image
              src={logoUrl || "/images/brand/logo.png"}
              alt={name}
              width={640}
              height={622}
              className="h-10 w-auto shrink-0 object-contain"
            />
            {name}
          </Link>
          <p className="mt-3 text-sm text-ink-400 max-w-xs leading-relaxed">{t("footer_tagline")}</p>
          <div className="flex items-center gap-3 mt-5">
            <a href="/about#contact" aria-label="Email" className="h-9 w-9 flex items-center justify-center rounded-full border border-ink-100 dark:border-white/10 hover:bg-ink-50 dark:hover:bg-white/5 text-ink-600 dark:text-ink-100">
              <Mail size={16} />
            </a>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-semibold text-sm text-ink-800 dark:text-ink-50 mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-ink-400 hover:text-transit-500 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-100 dark:border-white/10 py-5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-400">
          <p>© 2026 {name} · {t("footer_rights")}</p>
          <div className="flex items-center gap-4">
            <Link href="/about#privacy" className="hover:text-transit-500">{t("footer_privacy")}</Link>
            <Link href="/about#terms" className="hover:text-transit-500">{t("footer_terms")}</Link>
            <Link href="/sitemap.xml" className="hover:text-transit-500">{t("footer_sitemap")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
