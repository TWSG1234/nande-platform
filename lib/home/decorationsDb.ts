import { prisma } from "@/lib/prisma";
import { AREAS, Area, DEFAULT_DESKTOP, DEFAULT_MOBILE, Decoration, cleanName, parseDevice } from "./decorations";

/**
 * 伺服器端存取（不要在 client component 匯入）。
 * 讀取在資料表還沒建立（尚未 npm run db:push）或任何錯誤時回傳空陣列＝首頁完全照舊，不會出錯。
 */
export function rowToDecoration(r: Record<string, unknown>): Decoration {
  return {
    id: String(r.id),
    name: typeof r.name === "string" ? r.name : "",
    imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : "",
    naturalWidth: typeof r.naturalWidth === "number" ? r.naturalWidth : 0,
    naturalHeight: typeof r.naturalHeight === "number" ? r.naturalHeight : 0,
    isVisible: r.isVisible !== false,
    area: AREAS.includes(r.area as Area) ? (r.area as Area) : "hero",
    sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : 0,
    desktop: parseDevice(r.desktopJson, DEFAULT_DESKTOP),
    mobile: parseDevice(r.mobileJson, DEFAULT_MOBILE),
  };
}

export async function getHomeDecorations(): Promise<Decoration[]> {
  try {
    const rows = await prisma.homeDecoration.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return (rows as unknown as Record<string, unknown>[]).map(rowToDecoration);
  } catch (err) {
    console.warn("[home-decor] 讀取失敗（資料表可能尚未建立，請執行 npm run db:push），首頁暫不顯示裝飾：", (err as Error)?.message);
    return [];
  }
}

export { cleanName };
