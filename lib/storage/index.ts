/**
 * 檔案儲存抽象層：網站功能只呼叫這裡，不直接碰任何電腦資料夾。
 *
 * STORAGE_DRIVER=local（預設）→ 固定資料夾下的 uploads（見 lib/config/dataConfig.ts）
 * STORAGE_DRIVER=cloudinary  → Cloudinary 雲端圖片儲存（官方 SDK、伺服器端簽名上傳，見 ./cloudinary.ts）。
 *                              設定缺漏會明確報錯，不會悄悄改存本機。
 *
 * 資料庫裡存的永遠是 /uploads/<subdir>/<檔名> 這種「站內網址」；
 * 本機模式由 /api/files 讀取（next.config.js 把 /uploads/* 轉過去），
 * 未來雲端模式可在這一層改成 CDN 網址或轉址，資料庫內容不必搬動。
 */
import { mkdir, writeFile, rename, readFile } from "fs/promises";
import path from "path";
import { getDataConfig } from "@/lib/config/dataConfig";
import { createCloudinaryStorageFromEnv } from "./cloudinary";
import { realFileInside, resolveUploadFile, segmentsFromUploadUrl } from "./localPath";

export interface FileStorage {
  /** 存檔，回傳站內網址（例如 /uploads/content/xxx.png）。不覆蓋既有檔案。 */
  put(subdir: string, filename: string, data: Buffer): Promise<string>;
  /** 「刪除」：本機驅動是移到 _trash/（不真正刪檔）；找不到或不是本站檔案就安靜略過。 */
  remove(url: string | null | undefined): Promise<void>;
  /** 讀取內容；找不到回傳 null。 */
  read(url: string): Promise<Buffer | null>;
  /** 檔案是否真的存在（不讀內容，適合大檔案如影片）。 */
  exists(url: string): Promise<boolean>;
}

function localRoot(): string {
  const cfg = getDataConfig();
  if (!cfg.uploadsDir) throw new Error("STORAGE_DRIVER=local 需要上傳資料夾（NANDE_UPLOADS_DIR 或固定資料資料夾）。");
  return cfg.uploadsDir;
}

export const localStorage: FileStorage = {
  async put(subdir, filename, data) {
    if (!/^[a-z0-9_-]+$/i.test(subdir)) throw new Error("不合法的上傳子資料夾名稱。");
    const root = localRoot();
    const target = resolveUploadFile(root, [subdir, filename], { allowAnimation: true });
    if (!target) throw new Error("不合法的上傳檔名。");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: "wx" }); // wx：檔案已存在就失敗，絕不覆蓋舊檔
    return `/uploads/${subdir}/${filename}`;
  },
  async remove(url) {
    if (!url) return;
    const segs = segmentsFromUploadUrl(url);
    if (!segs) return;
    const root = localRoot();
    const target = resolveUploadFile(root, segs, { allowAnimation: true });
    const real = target && realFileInside(root, target);
    if (!real) return;
    // 不直接刪檔：移到上傳資料夾的 _trash/（加時間戳，不覆蓋），之後可以手動找回或自行清理。
    try {
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
      const dest = path.join(root, "_trash", `${stamp}-${Math.random().toString(36).slice(2, 6)}-${segs.join("__")}`);
      await mkdir(path.dirname(dest), { recursive: true });
      await rename(real, dest);
    } catch {
      /* 已被移除就算了 */
    }
  },
  async read(url) {
    const segs = segmentsFromUploadUrl(url);
    if (!segs) return null;
    const root = localRoot();
    const target = resolveUploadFile(root, segs, { allowAnimation: true });
    const real = target && realFileInside(root, target);
    return real ? readFile(real) : null;
  },
  async exists(url) {
    const segs = segmentsFromUploadUrl(url);
    if (!segs) return false;
    const root = localRoot();
    const target = resolveUploadFile(root, segs, { allowAnimation: true });
    return !!(target && realFileInside(root, target));
  },
};

type CloudinaryStorage = ReturnType<typeof import("./cloudinary").createCloudinaryStorage>;
let cloudinaryInstance: CloudinaryStorage | null = null;
let cloudinaryLoading: Promise<CloudinaryStorage> | null = null;
async function getCloudinary(): Promise<CloudinaryStorage> {
  if (cloudinaryInstance) return cloudinaryInstance;
  cloudinaryLoading ??= createCloudinaryStorageFromEnv().then((c) => (cloudinaryInstance = c));
  try {
    return await cloudinaryLoading;
  } catch (e) {
    cloudinaryLoading = null; // 設定錯誤時下次再試（例如補上環境變數後）
    throw e;
  }
}
/** Cloudinary 驅動（STORAGE_DRIVER=cloudinary）。第一次使用才建立連線；設定缺漏會明確報錯，不會悄悄改存本機。 */
export const cloudStorage: FileStorage = {
  put: async (...a) => (await getCloudinary()).put(...a),
  remove: async (...a) => (await getCloudinary()).remove(...a),
  read: async (...a) => (await getCloudinary()).read(...a),
  exists: async (...a) => (await getCloudinary()).exists(...a),
};
/** /uploads/... → Cloudinary https Secure URL（只組網址，不連網）；不是合法上傳網址回傳 null。 */
export async function cloudinaryDeliveryUrl(url: string): Promise<string | null> {
  return (await getCloudinary()).deliveryUrl(url);
}
/** 測試用：注入假的 Cloudinary 驅動。 */
export function __setCloudinaryStorageForTest(s: CloudinaryStorage | null) {
  cloudinaryInstance = s;
  cloudinaryLoading = null;
}

export type StorageDriver = "local" | "cloudinary";
export function getStorageDriver(): StorageDriver {
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (driver === "local") return "local";
  if (driver === "cloudinary") return "cloudinary";
  if (driver === "s3") throw new Error("STORAGE_DRIVER=s3 尚未實作；雲端儲存請改用 STORAGE_DRIVER=cloudinary。");
  throw new Error(`未知的 STORAGE_DRIVER：${driver}（只能是 local 或 cloudinary）。`);
}

export function getStorage(): FileStorage {
  return getStorageDriver() === "cloudinary" ? cloudStorage : localStorage;
}
