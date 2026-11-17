/**
 * 照片牆圖片網址與載入狀態的純邏輯（沒有 React／瀏覽器相依，伺服器與前端共用，也方便測試）。
 *
 * 資料庫存的 previewUrl 一律不改：
 *   - Google Drive 投稿：https://drive.google.com/uc?id=<ID>（新舊投稿相同）→ 顯示時推算縮圖網址，失敗退回原網址
 *   - 其他（/uploads/...、Cloudinary、任何非 Drive 網址）：原樣使用，不加任何處理
 */

export const PHOTO_PAGE_SIZE = 12;
export const GRID_THUMB_WIDTH = 600;
export const DETAIL_THUMB_WIDTH = 1600;

const DRIVE_HOST = "drive.google.com";
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

/** 只接受「真正的 drive.google.com」且能取出合法 file ID 的網址；其他一律回傳 null（含長得像的假網域）。 */
export function driveFileIdOf(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null; // /uploads/... 這類站內相對路徑
  }
  if (u.protocol !== "https:" || u.hostname !== DRIVE_HOST) return null;
  const q = u.searchParams.get("id");
  if (q && FILE_ID_RE.test(q) && (u.pathname === "/uc" || u.pathname === "/open" || u.pathname === "/thumbnail")) return q;
  const m = u.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/);
  return m ? m[1]! : null;
}

export function driveThumbnailUrl(fileId: string, width: number): string {
  if (!FILE_ID_RE.test(fileId)) throw new Error("invalid Drive file id");
  const w = Math.min(2000, Math.max(100, Math.round(width)));
  return `https://${DRIVE_HOST}/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${w}`;
}

export type PhotoSources = { primary: string; fallback: string | null };

/** 依用途決定「先載入哪個網址」與「失敗時退回哪個網址」。沒有圖片網址回傳 null。 */
export function photoSources(imageUrl: string | null | undefined, kind: "grid" | "detail"): PhotoSources | null {
  if (!imageUrl) return null;
  const id = driveFileIdOf(imageUrl);
  if (!id) return { primary: imageUrl, fallback: null }; // 非 Drive：維持原本網址
  return { primary: driveThumbnailUrl(id, kind === "grid" ? GRID_THUMB_WIDTH : DETAIL_THUMB_WIDTH), fallback: imageUrl };
}

// ── 載入狀態機：縮圖 → 原圖 → 佔位 ─────────────────────────────────────────
export type ImageStage = "primary" | "fallback" | "failed";

/** 圖片載入失敗時的下一個階段。每個階段只會前進一次，不會無限重試。 */
export function stageAfterError(stage: ImageStage, hasFallback: boolean): ImageStage {
  if (stage === "primary") return hasFallback ? "fallback" : "failed";
  return "failed";
}

// ── 分批顯示 ───────────────────────────────────────────────────────────────
/** 目前要顯示的照片：永遠是原陣列（伺服器已依 createdAt 由新到舊排好）的前 count 筆，順序不變。 */
export function visibleSlice<T>(all: readonly T[], count: number): T[] {
  return all.slice(0, Math.max(0, count));
}
export function nextCount(current: number, total: number, pageSize = PHOTO_PAGE_SIZE): number {
  return Math.min(total, current + pageSize);
}
export function remaining(total: number, shown: number): number {
  return Math.max(0, total - shown);
}
