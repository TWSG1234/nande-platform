"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import CookieConsent from "@/components/CookieConsent";
import WilloAssistant from "@/components/ai/WilloAssistant";
import type { AssistantPublicConfig } from "@/lib/ai/types";

/**
 * 這是「管理後台會被前台導覽列帶走」這個 bug 的真正修法。
 *
 * 問題根源：app/layout.tsx 是整個網站唯一的 root layout，原本直接把
 * <Navbar /> 和 <Footer /> 包在 {children} 外面。Next.js App Router 的巢狀
 * layout 是「疊加」而不是「取代」——app/admin/layout.tsx 不管怎麼寫，都沒辦法
 * 讓自己的頁面跳出 root layout 的 <Navbar />，所以公開網站的導覽列一直都會
 * 出現在 /admin 的最上面，點了就會跳出後台。
 *
 * 修法：把「是否顯示公開網站的 chrome（導覽列/頁尾/回頂端/Cookie 提示）」
 * 這個判斷，從「寫死在 root layout」改成「用目前網址判斷」——如果網址是
 * /admin 開頭，這裡什麼都不渲染，只留 <main>，把畫面完全交給
 * app/admin/layout.tsx 自己的 AdminShell 全權處理。
 */
export default function SiteChrome({
  children,
  logoUrl,
  siteName,
  assistantConfig,
}: {
  children: React.ReactNode;
  logoUrl?: string | null;
  siteName?: string;
  /** 威洛小助理設定（後台可調）；未提供或停用時前台不顯示小助理 */
  assistantConfig?: AssistantPublicConfig;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <>
      <Navbar logoUrl={logoUrl} siteName={siteName} />
      <main id="main-content">{children}</main>
      <Footer siteName={siteName} logoUrl={logoUrl} />
      <BackToTop />
      <CookieConsent />
      {assistantConfig?.settings.enabled && <WilloAssistant config={assistantConfig} />}
    </>
  );
}
