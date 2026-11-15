/**
 * 節日小圖「依檔名比對節日名稱」：public/holiday-icons/端午節.png → 名稱含「端午節」的節日。
 * 規則：
 * - 檔名（不含副檔名）包含在節日中文名稱裡就算對應；多張都符合時取檔名最長的（最具體的）。
 * - 補假（isMakeup 或名稱含「補假」）一律不放圖。
 * - 後台為該節日設定的小圖（資料庫 imageUrl）優先，這裡只補「沒有設定」的節日。
 * 純比對函式（matchHolidayIcon）不碰檔案系統，方便測試；listHolidayIcons 才讀資料夾。
 */
import fs from "fs";
import path from "path";
import type { CalendarEvent } from "@/lib/types";

const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif|avif)$/i;
export const HOLIDAY_ICON_DIR = "holiday-icons";

export function listHolidayIcons(dir = path.join(process.cwd(), "public", HOLIDAY_ICON_DIR)): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f) && !f.startsWith("."));
  } catch {
    return [];
  }
}

export function isMakeupEvent(e: { isMakeup?: boolean; name: { "zh-TW": string } }) {
  return Boolean(e.isMakeup) || e.name["zh-TW"].includes("補假");
}

/** 回傳 /holiday-icons/<檔名>（已做網址編碼）或 undefined。 */
export function matchHolidayIcon(e: Pick<CalendarEvent, "isMakeup" | "name">, files: string[]): string | undefined {
  if (isMakeupEvent(e)) return undefined;
  const name = e.name["zh-TW"].replace(/\s+/g, "");
  let best: { file: string; len: number } | null = null;
  for (const file of files) {
    const stem = file.replace(IMAGE_EXT, "").replace(/\s+/g, "");
    if (!stem || !name.includes(stem)) continue;
    if (!best || stem.length > best.len) best = { file, len: stem.length };
  }
  return best ? `/${HOLIDAY_ICON_DIR}/${encodeURIComponent(best.file)}` : undefined;
}

/** 沒有後台小圖的節日，補上依名稱比對到的內建小圖。 */
export function withHolidayIcons(events: CalendarEvent[], files = listHolidayIcons()): CalendarEvent[] {
  if (files.length === 0) return events;
  return events.map((e) => {
    if (e.image) return e;
    const image = matchHolidayIcon(e, files);
    return image ? { ...e, image } : e;
  });
}
