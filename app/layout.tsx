import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_TC, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import SiteChrome from "@/components/SiteChrome";
import ThemeStyleInjector from "@/components/ThemeStyleInjector";
import { getSiteAppearance } from "@/lib/serverData";
import { getAssistantPublicConfig } from "@/lib/ai/assistantData";

const display = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const body = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const appearance = await getSiteAppearance();
  const name = appearance.siteNameZh || "南得遇見你";
  return {
    metadataBase: new URL("https://taiwancompass.example.edu"),
    title: {
      default: `${name}｜國際交換生來台生活平台`,
      template: `%s｜${name}`,
    },
    description:
      "幫助國際交換學生快速適應台灣生活的一站式平台：校園座標、生活座標、中文學習、台灣行事曆與論壇交流。",
    keywords: ["交換生", "留學生", "台灣生活", "Exchange Student Taiwan", "國際生"],
    openGraph: {
      title: `${name}｜國際交換生來台生活平台`,
      description: "校園、生活、語言、文化，一站導航你在台灣的每一段路。",
      url: "https://taiwancompass.example.edu",
      siteName: name,
      locale: "zh_TW",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name}｜國際交換生來台生活平台`,
      description: "校園、生活、語言、文化，一站導航你在台灣的每一段路。",
    },
    icons: {
      icon: "/icons/favicon.png",
      apple: "/icons/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1717" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appearance = await getSiteAppearance();
  const assistantConfig = await getAssistantPublicConfig();

  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <ThemeStyleInjector />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-body antialiased bg-canvas-light dark:bg-canvas-dark text-ink-900 dark:text-ink-50 transition-colors`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-transit-500 focus:text-white focus:px-4 focus:py-2"
        >
          跳到主要內容
        </a>
        <Providers>
          <SiteChrome logoUrl={appearance.logoUrl} siteName={appearance.siteNameZh} assistantConfig={assistantConfig}>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
