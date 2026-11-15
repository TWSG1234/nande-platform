/**
 * 節日小圖批次對應（純邏輯，無資料庫）：圖檔「檔名 = 節日名稱」。
 *
 * 規則（全部只新增、不覆蓋）：
 * - 檔名去掉副檔名後，和節日中文名稱比對（全形半形統一、忽略空白）。
 * - 同名節日不只一筆（例如多日連假）時不猜：請把檔名改成「名稱@節日編號」，否則列為「無法判斷」。
 * - 該節日已經有小圖 → 略過（不覆蓋）；要換請到後台。
 * - 找不到對應節日、或兩個檔案對到同一個節日 → 只列出，不處理。
 */
export interface EventRow {
  id: string;
  date: string;
  nameZh: string;
  imageUrl: string | null;
}
export type Item =
  | { kind: "assign"; file: string; event: EventRow }
  | { kind: "skip-has-image"; file: string; event: EventRow }
  | { kind: "no-match"; file: string }
  | { kind: "ambiguous"; file: string; reason: string; candidates: EventRow[] }
  | { kind: "bad-file"; file: string; reason: string };

export const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

export const normalizeName = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

export function planCalendarImages(files: string[], events: EventRow[]): Item[] {
  const items: Item[] = [];
  const claimed = new Map<string, string>(); // eventId -> file
  for (const file of [...files].sort()) {
    const dot = file.lastIndexOf(".");
    const ext = dot >= 0 ? file.slice(dot).toLowerCase() : "";
    if (!IMAGE_EXTS.includes(ext)) {
      items.push({ kind: "bad-file", file, reason: "不是 png／jpg／webp 圖片" });
      continue;
    }
    const stem = file.slice(0, dot);
    const at = stem.lastIndexOf("@");
    const byId = at > 0 ? events.find((e) => e.id === stem.slice(at + 1).trim()) : undefined;
    const namePart = at > 0 && byId ? stem.slice(0, at) : stem;
    let target: EventRow | undefined;
    if (byId) {
      if (normalizeName(byId.nameZh) !== normalizeName(namePart)) {
        items.push({ kind: "ambiguous", file, reason: `編號 ${byId.id} 的節日是「${byId.nameZh}」，和檔名的名稱不一致`, candidates: [byId] });
        continue;
      }
      target = byId;
    } else {
      const hits = events.filter((e) => normalizeName(e.nameZh) === normalizeName(namePart));
      if (hits.length === 0) {
        items.push({ kind: "no-match", file });
        continue;
      }
      if (hits.length > 1) {
        items.push({ kind: "ambiguous", file, reason: `有 ${hits.length} 筆同名節日，請把檔名改成「名稱@節日編號」`, candidates: hits });
        continue;
      }
      target = hits[0]!;
    }
    if (target.imageUrl) {
      items.push({ kind: "skip-has-image", file, event: target });
      continue;
    }
    const prev = claimed.get(target.id);
    if (prev) {
      items.push({ kind: "ambiguous", file, reason: `「${target.nameZh}」已經被 ${prev} 對應，這個檔案不處理`, candidates: [target] });
      continue;
    }
    claimed.set(target.id, file);
    items.push({ kind: "assign", file, event: target });
  }
  return items;
}
