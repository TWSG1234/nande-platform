/**
 * Cloudinary 儲存驅動（官方 SDK `cloudinary`，伺服器端簽名上傳）。
 *
 * 設計重點
 * 1. 資料庫裡存的仍然是站內網址 /uploads/<子資料夾>/<檔名>（和本機模式完全一樣）。
 *    所以 local ↔ cloudinary 切換不用改任何資料庫內容、舊資料不會失效；
 *    檢查 /uploads/ 開頭的各處（imageRefs、行事曆、IP 圖片…）都不用改。
 *    前台載入 /uploads/... 時由 /api/files 轉址到 Cloudinary 的 https Secure URL（deliveryUrl()）。
 * 2. 簽名上傳：SDK 用 API Secret 在「伺服器端」計算簽名，Secret 不會出現在前端或回應內容；
 *    API Key／Secret 只從環境變數讀取。
 * 3. 檔案在 Cloudinary 的 public_id ＝ <CLOUDINARY_FOLDER>/<子資料夾（可多層）>/<識別名>（規則見 parseUploadUrl）：
 *    - UUID 檔名（網站上傳的新圖，都是這種）：識別名 ＝ UUID，不含副檔名（與舊版完全相同，已上傳的圖不受影響）；
 *    - 其他檔名（內建圖、搬遷的舊圖）：識別名 ＝ <檔名>__<副檔名>，所以 a.png 與 a.jpg 不會共用同一個 public_id、不會互相覆蓋；
 *    - 檔名或資料夾名含中文、空白、點、特殊符號：該段改成 h-<SHA1 前 20 碼>（由網址推算、固定不變，不需要改資料庫）。
 *    圖片／GIF／SVG 使用 image 資源類型，MP4 使用 video 資源類型。
 * 4. 「刪除」預設是移到 <folder>/_trash/（用 rename，可以在 Cloudinary 後台找回），與本機模式的 _trash 一致；
 *    設 CLOUDINARY_DELETE_MODE=destroy 才會永久刪除。
 * 5. 不覆蓋：put 前先確認不存在，且上傳時 overwrite=false。
 */
import crypto from "crypto";
import { resolveUploadFile, segmentsFromUploadUrl } from "./localPath";
import type { FileStorage } from "./index";

export interface CloudinaryUploaderLike {
  upload_stream(options: Record<string, unknown>, cb: (err: any, result: any) => void): { end(data: Buffer): void };
  rename(from: string, to: string, options?: Record<string, unknown>): Promise<any>;
  destroy(publicId: string, options?: Record<string, unknown>): Promise<any>;
}
/** Admin API 中「查單一資源」的最小介面（只在傳遞網址無法判斷時，作為權威的存在檢查）。 */
export interface CloudinaryApiLike {
  resource(publicId: string, options?: Record<string, unknown>): Promise<any>;
}

export interface CloudinaryDeps {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  uploader: CloudinaryUploaderLike;
  api?: CloudinaryApiLike;
  /** 預設 https://res.cloudinary.com（測試時可換成假伺服器）。 */
  deliveryBase?: string;
  deleteMode?: "trash" | "destroy";
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const MAX_READ_BYTES = 60 * 1024 * 1024;
const VIDEO_EXT = new Set([".mp4"]);

export function normalizeFolder(f: string | undefined | null): string {
  const t = (f ?? "nande-platform").trim().replace(/^\/+|\/+$/g, "");
  if (!t || !/^[A-Za-z0-9_\-\/]+$/.test(t) || t.includes("..") || t.split("/").some((p) => !p || p.startsWith("_"))) {
    throw new Error("CLOUDINARY_FOLDER 只能包含英數字、_、-、/，且資料夾名稱不可以底線開頭。");
  }
  return t;
}

const MAX_DEPTH = 6; // 子資料夾最多 5 層＋檔名
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_RE = /^[A-Za-z0-9_\-]+$/;
/** 固定、可重算的安全名稱：本來就安全的原樣保留；含中文／空白／點／特殊符號的改成 h-<SHA1 前 20 碼>。 */
const safeSeg = (s: string) => (SAFE_RE.test(s) ? s : "h-" + crypto.createHash("sha1").update(s, "utf8").digest("hex").slice(0, 20));

export interface ParsedUpload {
  /** 原始子資料夾（多層以 / 連接，例如 content/life-comics） */
  subdir: string;
  filename: string;
  base: string;
  ext: string;
  /** Cloudinary 上的資料夾（各層經過 safeSeg） */
  idDir: string;
  /** Cloudinary 上的識別名（不含資料夾；UUID 檔名＝UUID，其餘＝<檔名>__<副檔名>） */
  idBase: string;
  /** 路徑或檔名被轉成雜湊（原名含不安全字元） */
  hashed: boolean;
}

/** 站內網址 → ParsedUpload；不合法（穿越、內部資料夾、非白名單副檔名、太深…）回傳 null。支援 /uploads/<子資料夾>[/<更深資料夾>…]/<檔名>。 */
export function parseUploadUrl(url: string | null | undefined): ParsedUpload | null {
  if (!url) return null;
  const segs = segmentsFromUploadUrl(url);
  if (!segs || segs.length < 2 || segs.length > MAX_DEPTH) return null;
  if (!resolveUploadFile("/virtual-root", segs, { allowAnimation: true })) return null; // 與本機驅動同一套安全規則
  const dirs = segs.slice(0, -1);
  const filename = segs[segs.length - 1]!;
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = filename.slice(0, dot);
  const ext = filename.slice(dot).toLowerCase();
  const idDir = dirs.map(safeSeg).join("/");
  const hashed = dirs.some((d) => !SAFE_RE.test(d)) || !SAFE_RE.test(base);
  const idBase = UUID_RE.test(base) ? base : `${safeSeg(base)}__${ext.slice(1)}`;
  return { subdir: dirs.join("/"), filename, base, ext, idDir, idBase, hashed };
}

/** 完整 public_id（含 CLOUDINARY_FOLDER）。掃描工具與驅動用同一個函式，所以「預計的 public_id」就是實際上傳會用的。 */
export function publicIdFor(folder: string, p: Pick<ParsedUpload, "idDir" | "idBase">): string {
  return `${normalizeFolder(folder)}/${p.idDir}/${p.idBase}`;
}

export function resourceTypeFor(ext: string): "image" | "video" {
  return VIDEO_EXT.has(ext) ? "video" : "image";
}

/** Admin API 查到的資源資訊（遷移工具用；不經過 CDN，所以是「有沒有這個 public_id」的權威答案）。 */
export interface CloudinaryAssetInfo { publicId: string; version?: number; bytes?: number; format?: string; secureUrl?: string }

export function createCloudinaryStorage(deps: CloudinaryDeps): FileStorage & { deliveryUrl(url: string): string | null; inspect(url: string): Promise<CloudinaryAssetInfo | null> } {
  const folder = normalizeFolder(deps.folder);
  const base = (deps.deliveryBase ?? "https://res.cloudinary.com").replace(/\/+$/, "");
  const doFetch = deps.fetchImpl ?? fetch;
  const auth = { cloud_name: deps.cloudName, api_key: deps.apiKey, api_secret: deps.apiSecret };
  const timeout = deps.timeoutMs ?? 20000;

  const idOf = (p: ParsedUpload) => `${folder}/${p.idDir}/${p.idBase}`;
  const deliveryOf = (p: ParsedUpload, version?: number | string) =>
    `${base}/${encodeURIComponent(deps.cloudName)}/${resourceTypeFor(p.ext)}/upload/${version ? `v${version}/` : ""}${folder.split("/").map(encodeURIComponent).join("/")}/${p.idDir.split("/").map(encodeURIComponent).join("/")}/${encodeURIComponent(p.idBase)}${p.ext}`;

  /**
   * 向 Admin API 查「這個 public_id 是否存在」——不經過 CDN，所以不會被快取影響，是權威答案。
   * 回傳 { version }（存在）或 null（確定不存在）；其他錯誤（限流、網路）丟錯，絕不當成不存在。
   * 沒有提供 api 時回傳 undefined（呼叫端自行降級）。
   */
  const lookup = async (p: ParsedUpload): Promise<{ version?: number } | null | undefined> => {
    if (!deps.api) return undefined;
    try {
      const r = await deps.api.resource(idOf(p), { ...auth, resource_type: resourceTypeFor(p.ext), type: "upload" });
      return { version: r?.version };
    } catch (err: any) {
      if (err?.http_code === 404 || err?.error?.http_code === 404) return null;
      throw new Error(`Cloudinary 檢查檔案失敗：${String(err?.message ?? err?.error?.message ?? "未知錯誤").slice(0, 160)}`);
    }
  };

  /**
   * 傳遞網址（res.cloudinary.com）的兩個重要特性（真實帳號測試發現）：
   *  1. 對 HEAD 可能回 404，所以不用 HEAD，改用 GET（存在檢查用 Range: bytes=0-0，只取 1 byte 後立刻關閉）。
   *  2. 「檔案還不存在時」請求過的網址，會被 CDN 暫時快取 404；之後檔案上傳了，同一個網址仍會回 404 一陣子。
   *     所以【上傳之前絕不探測傳遞網址】——上傳前的重複檢查只用 Admin API；傳遞網址回 404 時，也要用 Admin API 再確認一次，
   *     確認檔案其實存在時，改用「帶版本號」的網址（不同網址＝繞過被快取的 404）。
   */
  const probe = async (u: string, ranged: boolean): Promise<number> => {
    try {
      const res = await doFetch(u, { method: "GET", headers: ranged ? { Range: "bytes=0-0" } : {}, signal: AbortSignal.timeout(timeout), redirect: "follow" });
      if (ranged) await res.body?.cancel().catch(() => {});
      return res.status;
    } catch {
      return 0;
    }
  };

  const exists = async (p: ParsedUpload): Promise<boolean> => {
    const status = await probe(deliveryOf(p), true);
    if (status === 200 || status === 206) return true; // 快速路徑：不需要 Admin API
    // 404（可能是被快取的）或無法判斷（429／5xx／連線錯誤）：由 Admin API 作最後判斷
    const found = await lookup(p);
    if (found === undefined) {
      if (status === 404) return false; // 沒有 Admin API 可用時，只能相信傳遞網址
      throw new Error(`Cloudinary 檢查檔案失敗（HTTP ${status || "連線錯誤"}）。`);
    }
    return found !== null;
  };

  return {
    deliveryUrl(url) {
      const p = parseUploadUrl(url);
      return p ? deliveryOf(p) : null;
    },

    /** 只問 Admin API（唯讀）：存在回傳資訊、確定不存在回傳 null；其他錯誤丟錯。需要提供 api。 */
    async inspect(url) {
      const p = parseUploadUrl(url);
      if (!p) return null;
      if (!deps.api) throw new Error("inspect 需要 Admin API。");
      try {
        const r = await deps.api.resource(idOf(p), { ...auth, resource_type: resourceTypeFor(p.ext), type: "upload" });
        return { publicId: String(r?.public_id ?? idOf(p)), version: r?.version, bytes: r?.bytes, format: r?.format, secureUrl: typeof r?.secure_url === "string" ? r.secure_url : undefined };
      } catch (err: any) {
        if (err?.http_code === 404 || err?.error?.http_code === 404) return null;
        throw new Error(`Cloudinary 檢查檔案失敗：${String(err?.message ?? err?.error?.message ?? "未知錯誤").slice(0, 160)}`);
      }
    },

    async put(subdir, filename, data) {
      const p = parseUploadUrl(`/uploads/${subdir}/${filename}`);
      // 防止 ? # % 之類的字元讓網址被截斷、對到別的檔案：解析結果必須與傳入的完全一致。
      if (!p || p.subdir !== subdir || p.filename !== filename) throw new Error("不合法的上傳子資料夾或檔名。");
      // 上傳前的重複檢查只問 Admin API，【不碰傳遞網址】（避免 CDN 快取住 404，讓剛上傳的檔案讀不到）。
      // 真正的保證在下面：overwrite:false + 檢查 existing 旗標。
      if ((await lookup(p)) != null) throw new Error("檔案已存在，不會覆蓋既有檔案。");
      const opts: Record<string, unknown> = {
        ...auth,
        public_id: idOf(p),
        resource_type: resourceTypeFor(p.ext),
        type: "upload",
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        allowed_formats: [p.ext.slice(1) === "jpeg" ? "jpg" : p.ext.slice(1)],
      };
      const result: any = await new Promise((resolve, reject) => {
        const stream = deps.uploader.upload_stream(opts, (err, res) => (err ? reject(err) : resolve(res)));
        stream.end(data);
      }).catch((err) => {
        // 只轉出安全的訊息（SDK 錯誤不含 Secret，但仍不整包輸出）
        throw new Error(`Cloudinary 上傳失敗：${String(err?.message ?? "未知錯誤").slice(0, 200)}`);
      });
      // overwrite:false 時，Cloudinary 遇到同一個 public_id 不會報錯，而是「不動原檔、回傳既有資源並標記 existing:true」。
      // 所以一定要檢查這個旗標：existing 為真＝這次沒有寫入任何東西，必須當作失敗（原檔保持不變）。
      if (result?.existing === true) throw new Error("檔案已存在，不會覆蓋既有檔案。");
      if (!result?.secure_url || !String(result.secure_url).startsWith("https://")) throw new Error("Cloudinary 沒有回傳 https 的 Secure URL，上傳視為失敗。");
      return `/uploads/${subdir}/${filename}`;
    },

    async remove(url) {
      const p = parseUploadUrl(url);
      if (!p) return;
      const common = { ...auth, resource_type: resourceTypeFor(p.ext), invalidate: true };
      try {
        if (deps.deleteMode === "destroy") {
          await deps.uploader.destroy(idOf(p), { ...common, type: "upload" });
        } else {
          const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
          const to = `${folder}/_trash/${stamp}-${Math.random().toString(36).slice(2, 6)}-${p.idDir.replace(/\//g, "-")}__${p.idBase}`;
          await deps.uploader.rename(idOf(p), to, { ...common, overwrite: false });
        }
      } catch (err: any) {
        if (err?.http_code === 404 || /not found/i.test(String(err?.message ?? ""))) return; // 本來就不在了
        console.warn("[cloudinary] 移除失敗，原檔保留不動：", String(err?.message ?? err).slice(0, 200));
      }
    },

    async read(url) {
      const p = parseUploadUrl(url);
      if (!p) return null;
      let target = deliveryOf(p);
      let res = await doFetch(target, { signal: AbortSignal.timeout(timeout), redirect: "follow" });
      if (res.status === 404) {
        // 可能是 CDN 快取的 404：問 Admin API；確實存在就改用帶版本號的網址再讀一次
        const found = await lookup(p);
        if (!found) return null;
        if (found.version) {
          target = deliveryOf(p, found.version);
          res = await doFetch(target, { signal: AbortSignal.timeout(timeout), redirect: "follow" });
          if (res.status === 404) return null;
        } else return null;
      }
      if (!res.ok) throw new Error(`Cloudinary 讀取失敗（HTTP ${res.status}）。`);
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > MAX_READ_BYTES) throw new Error("檔案過大，不讀入記憶體。");
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_READ_BYTES) throw new Error("檔案過大，不讀入記憶體。");
      return buf;
    },

    async exists(url) {
      const p = parseUploadUrl(url);
      return p ? exists(p) : false;
    },
  };
}

/** 從環境變數讀設定：CLOUDINARY_CLOUD_NAME／API_KEY／API_SECRET，或 CLOUDINARY_URL=cloudinary://key:secret@cloud。 */
export function cloudinaryConfigFromEnv(env: NodeJS.ProcessEnv = process.env) {
  let cloudName = env.CLOUDINARY_CLOUD_NAME || "";
  let apiKey = env.CLOUDINARY_API_KEY || "";
  let apiSecret = env.CLOUDINARY_API_SECRET || "";
  if ((!cloudName || !apiKey || !apiSecret) && env.CLOUDINARY_URL) {
    try {
      const u = new URL(env.CLOUDINARY_URL);
      if (u.protocol === "cloudinary:") {
        cloudName ||= u.hostname;
        apiKey ||= decodeURIComponent(u.username);
        apiSecret ||= decodeURIComponent(u.password);
      }
    } catch {
      /* 下面會統一回報缺少哪些變數 */
    }
  }
  const missing = [["CLOUDINARY_CLOUD_NAME", cloudName], ["CLOUDINARY_API_KEY", apiKey], ["CLOUDINARY_API_SECRET", apiSecret]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`STORAGE_DRIVER=cloudinary 需要環境變數：${missing.join("、")}（或 CLOUDINARY_URL）。請放在 .env.local 或主機的環境變數，不要寫進程式碼。`);
  const mode = (env.CLOUDINARY_DELETE_MODE || "trash").toLowerCase();
  if (mode !== "trash" && mode !== "destroy") throw new Error("CLOUDINARY_DELETE_MODE 只能是 trash（預設，移到回收區）或 destroy（永久刪除）。");
  return { cloudName, apiKey, apiSecret, folder: normalizeFolder(env.CLOUDINARY_FOLDER), deleteMode: mode as "trash" | "destroy" };
}

export async function createCloudinaryStorageFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const cfg = cloudinaryConfigFromEnv(env);
  const { v2 } = await import("cloudinary"); // 只有用到 cloudinary 模式才載入
  // 同一份伺服器端設定也寫進 SDK 的全域設定，讓 uploader／api 的所有呼叫（含 Admin API）都有 cloud_name、金鑰；每次呼叫也仍明確帶入同一組。
  applyCloudinaryConfig(v2, cfg);
  return createCloudinaryStorage({ ...cfg, uploader: v2.uploader as unknown as CloudinaryUploaderLike, api: v2.api as unknown as CloudinaryApiLike });
}

/** 把設定寫進 SDK（全域）。所有 SDK 操作共用這一份，Secret 只留在伺服器端記憶體。 */
export function applyCloudinaryConfig(v2: { config: (c: Record<string, unknown>) => unknown }, cfg: { cloudName: string; apiKey: string; apiSecret: string }) {
  v2.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret, secure: true });
}
