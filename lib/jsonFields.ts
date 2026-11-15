/**
 * SQLite（目前使用的資料庫）不支援 Prisma 的 Json 型別，所以 schema.prisma 裡
 * 原本想用 Json 存的欄位（drink、vocabulary、sentences、taiwanCustoms、
 * exchangeStudentMayEncounter）都改成 String，實際存的是 JSON.stringify 過的文字。
 *
 * 這兩個函式統一處理「存進資料庫前」與「從資料庫讀出來後」的轉換，讓其他程式碼
 * （API 路由、seed 腳本）不用每個地方各自寫一次 JSON.parse / JSON.stringify。
 */

/** 存進資料庫之前：把物件/陣列轉成字串。value 是 undefined/null 就回傳 null（給可為空的欄位用）。 */
export function toJsonField(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/** 存進資料庫之前，給「不可為空」的欄位用（drink / vocabulary / sentences）。 */
export function toJsonFieldRequired(value: unknown, fallback: unknown): string {
  return JSON.stringify(value ?? fallback);
}

/** 從資料庫讀出來之後：把字串轉回物件/陣列。壞掉或不存在就回傳 fallback，不會讓頁面整個掛掉。 */
export function fromJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
