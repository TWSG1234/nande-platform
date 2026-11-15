import { prisma } from "@/lib/prisma";
import { IpLayouts, IpSavedFlags, MobileIpPrefs, defaultLayouts, resolveLayouts } from "./ipLayout";

/**
 * 伺服器端存取（不要在 client component 匯入）。
 * 讀取在資料表還沒建立（尚未 npm run db:push）或任何錯誤時回傳各裝置的預設版面＝首頁照常顯示，不會出錯。
 */
export async function getIpLayouts(mobilePrefs?: MobileIpPrefs[]): Promise<{ layouts: IpLayouts; saved: IpSavedFlags; tableReady: boolean }> {
  try {
    const rows = await prisma.ipHeroLayout.findMany();
    const r = resolveLayouts(rows as unknown as { id: string }[], mobilePrefs);
    return { ...r, tableReady: true };
  } catch (err) {
    console.warn("[ip-layout] 讀取失敗（資料表可能尚未建立，請執行 npm run db:push），首頁使用預設角色版面：", (err as Error)?.message);
    const layouts = defaultLayouts(mobilePrefs);
    const saved = Object.fromEntries(Object.keys(layouts).map((k) => [k, { desktop: false, tablet: false, mobile: false }])) as IpSavedFlags;
    return { layouts, saved, tableReady: false };
  }
}
