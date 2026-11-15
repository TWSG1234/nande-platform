import { randomUUID } from "crypto";
import { getStorage } from "@/lib/storage";
import { DECOR_LIMITS, PngValidationError, validateTransparentPng } from "./pngCheck";

export const DECOR_SUBDIR = "home-decor";

/** 驗證（副檔名＋瀏覽器回報類型＋實際 PNG 內容＋透明像素＋大小尺寸）並存進固定資料夾 uploads/home-decor。不合格丟 PngValidationError。 */
export async function saveDecorationPng(file: File): Promise<{ url: string; width: number; height: number }> {
  if (!/\.png$/i.test(file.name || "")) throw new PngValidationError("只接受 .png 檔案。請勿上傳 JPG、GIF、MP4、SVG 等其他格式。");
  const declared = (file.type || "").split(";")[0]!.trim().toLowerCase();
  if (declared && declared !== "image/png" && declared !== "application/octet-stream") throw new PngValidationError(`檔案類型（${declared}）不是 PNG。裝飾圖樣限定透明底 PNG。`);
  if (file.size > DECOR_LIMITS.maxBytes) throw new PngValidationError(`檔案太大（${(file.size / 1024 / 1024).toFixed(2)} MB），上限是 ${DECOR_LIMITS.maxBytes / 1024 / 1024} MB。`);
  const data = Buffer.from(await file.arrayBuffer());
  const info = validateTransparentPng(data);
  const url = await getStorage().put(DECOR_SUBDIR, `${randomUUID()}.png`, data);
  return { url, width: info.width, height: info.height };
}

export { PngValidationError };
