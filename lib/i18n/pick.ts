import { LangCode, Localized } from "@/lib/types";

/**
 * Resolve a bilingual field to the active language.
 * 只有「該語言真的沒有內容」（undefined／null／空白字串）才回退到中文——
 * 以前用 ?? 只擋 undefined，英文欄位是空字串時會顯示成一片空白。
 * 已經有英文內容時一定顯示英文，不會被中文取代。
 */
export function pick(field: Localized, lang: LangCode): string {
  const v = field[lang];
  if (typeof v === "string" && v.trim() !== "") return v;
  return field["zh-TW"];
}
