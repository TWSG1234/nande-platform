import crypto from "crypto";
import { getStorage } from "@/lib/storage";

/**
 * 圖片上傳共用邏輯。
 *
 * 實際存放位置由 lib/storage 決定（預設：固定資料資料夾下的 uploads，不在程式資料夾裡，
 * 換新版程式不會遺失；未來可換成雲端物件儲存）。回傳的是站內網址（/uploads/<subdir>/<檔名>），
 * 資料庫存的就是這個網址，格式與舊版相同。
 */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export class ImageValidationError extends Error {}

export function assertValidImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageValidationError("圖片格式不支援，請上傳 JPG、PNG 或 WebP 格式的圖片。");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("圖片太大，請選擇 10MB 以下的圖片。");
  }
}

function extensionFor(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/** 把上傳的 File 存起來，回傳站內網址（例如 /uploads/content/xxxx.jpg）。檔名一律是新的 UUID，不會覆蓋舊檔。 */
export async function saveLocalImage(file: File, subdir: "content" | "submissions") {
  assertValidImage(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${crypto.randomUUID()}.${extensionFor(file.type)}`;
  return getStorage().put(subdir, filename, buffer);
}

/** 讀取先前存的圖片內容（例如審核通過後要搬到 Google Drive）。找不到回傳 null。 */
export async function readStoredImage(url: string | null | undefined) {
  if (!url) return null;
  return getStorage().read(url);
}

/**
 * 刪除一張先前存的圖片。只處理 "/uploads/..." 站內網址，且實際路徑必須落在上傳資料夾內
 * （擋路徑穿越與符號連結）；找不到檔案（例如外部連結）就安靜略過。
 */
export async function deleteLocalImage(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/")) return;
  await getStorage().remove(url);
}
