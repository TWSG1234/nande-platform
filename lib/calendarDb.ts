/**
 * 行事曆讀寫的小工具：讓「節日小圖」這個新欄位（CalendarEvent.imageUrl）
 * 在使用者還沒執行 `npm run db:push` 之前，網站與後台也不會壞掉。
 *
 * 背景：Prisma 查詢預設會選取資料表「所有」欄位。schema 加了 imageUrl、但資料庫
 * 還沒有這個欄位時，每一次 calendarEvent 查詢都會丟錯（P2022）。
 * 因此：
 * - 讀取：先試完整查詢；欄位不存在就改用「不含 imageUrl」的明確欄位清單重試。
 * - 寫入：一律用 select 只回傳 id，不讓 Prisma 回讀 imageUrl。
 * 完全不改資料、不刪資料。
 */

/** 不含 imageUrl 的所有欄位（欄位新增前也能讀）。 */
export const CALENDAR_BASE_SELECT = {
  id: true,
  date: true,
  nameZh: true,
  nameEn: true,
  isHoliday: true,
  isMakeup: true,
  descriptionZh: true,
  descriptionEn: true,
  originZh: true,
  originEn: true,
  taiwanCustoms: true,
  sourceZh: true,
  sourceEn: true,
  noteZh: true,
  noteEn: true,
  enSource: true,
  tagZh: true,
  tagEn: true,
  isAnchor: true,
  groupLabelZh: true,
  groupLabelEn: true,
  isOfficial: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** 判斷錯誤是不是「資料庫缺 imageUrl 欄位」。 */
export function isMissingImageColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "P2022") return true;
  const msg = String(e.message ?? "");
  return /no such column|does not exist in the current database/i.test(msg) && /imageUrl/i.test(msg);
}

/** 站內圖片網址檢查：空字串代表移除；其他只接受 /uploads/ 開頭、沒有路徑穿越的網址。 */
export function normalizeImageUrl(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false };
  const s = v.trim();
  if (!s) return { ok: true, value: null };
  if (!s.startsWith("/uploads/") || s.includes("..") || s.includes("\\") || /[?#]/.test(s)) return { ok: false };
  return { ok: true, value: s };
}

export const IMAGE_COLUMN_MISSING_MESSAGE =
  "資料庫還沒有「節日小圖」欄位，請先在專案資料夾執行一次 npm run db:push（會自動備份、只新增一個欄位），再重新儲存。";
