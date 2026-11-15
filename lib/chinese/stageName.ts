import type { LangCode, Localized } from "@/lib/types";

/**
 * 關卡名稱依目前語言顯示：
 * - 中文：自訂中文名稱，沒有就「第 N 關」
 * - 英文：自訂英文名稱，沒有就「Level N」（不會把中文名稱當成英文名稱複製過去）
 */
export function stageName(title: Localized | null, levelNumber: number, lang: LangCode): string {
  const v = title?.[lang];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return lang === "zh-TW" ? `第 ${levelNumber} 關` : `Level ${levelNumber}`;
}

/** 後台儲存的 titleZh／titleEn → 前台用的雙語名稱；兩邊都空白才是 null。英文不會用中文補。 */
export function stageTitleFrom(titleZh: string | null | undefined, titleEn: string | null | undefined): Localized | null {
  const zh = (titleZh ?? "").trim();
  const en = (titleEn ?? "").trim();
  if (!zh && !en) return null;
  return { "zh-TW": zh, en };
}
