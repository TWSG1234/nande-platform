/**
 * 上傳檔案的「網址 ↔ 實體路徑」轉換與安全檢查（純 Node，可獨立測試）。
 * 網址格式維持相容：/uploads/<subdir>/<檔名>，例如 /uploads/content/xxxx.jpg。
 */
import fs from "fs";
import path from "path";

export const IMAGE_EXTENSIONS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** 「答題正確動畫」專用：只允許放在這個子資料夾，且只有 storage 層（管理員上傳）能用；一般 /api/files 路由不開放。 */
export const ANIMATION_SUBDIR = "chinese-animation";
export const ANIMATION_EXTENSIONS: Record<string, string> = {
  ".mp4": "video/mp4",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** 把 URL 路徑片段（不含 /uploads/ 前綴）轉成 uploadsRoot 底下的絕對路徑；不合法就回傳 null。 */
export function resolveUploadFile(uploadsRoot: string, segments: string[], opts?: { allowAnimation?: boolean }): string | null {
  if (!segments.length) return null;
  for (const s of segments) {
    if (!s || s === "." || s === ".." || /[\0\\:*?"<>|]/.test(s)) return null;
  }
  // 以 . 或 _ 開頭的資料夾（例如 _trash 回收區）是內部使用，不對外提供。
  if (segments[0]!.startsWith(".") || segments[0]!.startsWith("_")) return null;
  const root = path.resolve(uploadsRoot);
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(root + path.sep)) return null;
  const ext = path.extname(target).toLowerCase();
  if (ext in IMAGE_EXTENSIONS) return target;
  // mp4 / svg（以及 gif）只在 chinese-animation 子資料夾、且呼叫端明確允許時才通過。
  if (opts?.allowAnimation && segments.length === 2 && segments[0] === ANIMATION_SUBDIR && ext in ANIMATION_EXTENSIONS) return target;
  return null;
}

/** 連符號連結也要擋：真實路徑必須仍在上傳資料夾內。檔案不存在回傳 null。 */
export function realFileInside(uploadsRoot: string, target: string): string | null {
  try {
    const realRoot = fs.realpathSync(uploadsRoot);
    const real = fs.realpathSync(target);
    if (!real.startsWith(realRoot + path.sep)) return null;
    return fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

/** "/uploads/content/a.png" → ["content","a.png"]；不是本站上傳網址回傳 null。 */
export function segmentsFromUploadUrl(url: string): string[] | null {
  if (!url.startsWith("/uploads/")) return null;
  const clean = url.split(/[?#]/)[0]!;
  let decoded: string;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    return null;
  }
  return decoded.slice("/uploads/".length).split("/");
}
