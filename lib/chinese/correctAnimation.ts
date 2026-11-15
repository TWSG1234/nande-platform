/**
 * 「答題正確動畫」檔案驗證（純函式，可獨立測試；不碰資料庫與檔案系統）。
 * 一律以「檔案實際內容」判斷格式，副檔名與瀏覽器回報的 MIME 只用來交叉比對、不單獨採信。
 */
import { analyzeSvgAnimation, SvgAnimInfo } from "@/lib/chinese/svgAnim";

export type AnimationFormat = "mp4" | "gif" | "svg";

export const ANIMATION_LIMITS: Record<AnimationFormat, number> = {
  mp4: 8 * 1024 * 1024, // 8 MB
  gif: 5 * 1024 * 1024, // 5 MB
  svg: 512 * 1024, // 512 KB
};

export const FORMAT_MIME: Record<AnimationFormat, string> = {
  mp4: "video/mp4",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export class AnimationValidationError extends Error {}

const fmtMB = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(0)} MB` : `${Math.round(n / 1024)} KB`);
export const LIMIT_TEXT = `MP4 最大 ${fmtMB(ANIMATION_LIMITS.mp4)}、GIF 最大 ${fmtMB(ANIMATION_LIMITS.gif)}、SVG 最大 ${fmtMB(ANIMATION_LIMITS.svg)}`;

/** 由檔案內容判斷格式（魔術位元組）；認不出來回傳 null。 */
export function sniffFormat(buf: Buffer): AnimationFormat | null {
  if (buf.length >= 6 && (buf.subarray(0, 6).toString("latin1") === "GIF87a" || buf.subarray(0, 6).toString("latin1") === "GIF89a")) return "gif";
  if (buf.length >= 12 && buf.subarray(4, 8).toString("latin1") === "ftyp") return "mp4";
  // SVG 是文字：去掉 BOM／空白後必須以 <svg 或 <?xml 開頭
  const head = buf.subarray(0, 2048).toString("utf8").replace(/^﻿/, "").trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!--")) return /<svg[\s>]/.test(buf.subarray(0, 8192).toString("utf8").toLowerCase()) ? "svg" : null;
  return null;
}

/**
 * SVG 安全檢查：採「發現不安全內容就拒絕」，不嘗試改寫內容。
 * 前台只會用 <img> 載入 SVG（瀏覽器在 img 模式下本來就不執行腳本、不載入外部資源），
 * 這裡是第二道防線，同時避免有人直接開啟檔案網址時執行腳本。
 */
export function checkSvgSafe(text: string): string | null {
  const t = text.replace(/^﻿/, "");
  const lower = t.toLowerCase();
  if (/<!doctype|<!entity/.test(lower)) return "SVG 含有 DOCTYPE／ENTITY 宣告，為了安全不接受。";
  if (/<\s*script/.test(lower)) return "SVG 含有 <script> 腳本，為了安全不接受。";
  if (/<\s*(foreignobject|iframe|embed|object|audio|video|link|meta|style\s+[^>]*src)/.test(lower)) return "SVG 含有嵌入外部內容的標籤（foreignObject／iframe／object 等），為了安全不接受。";
  if (/\son[a-z]+\s*=/.test(lower)) return "SVG 含有事件屬性（例如 onload、onclick），為了安全不接受。";
  if (/javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/.test(lower)) return "SVG 含有可執行的連結（javascript:），為了安全不接受。";
  if (/@import/.test(lower)) return "SVG 的樣式含有 @import，為了安全不接受。";
  // 外部資源：href / xlink:href 只能指向檔案內部（#id）；樣式裡的 url() 也只能是 url(#id)
  const hrefRe = /(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(t))) {
    const v = (m[2] ?? m[3] ?? "").trim();
    if (!v.startsWith("#")) return "SVG 參照了外部資源（網址／其他檔案），為了安全只接受檔案內部的參照。";
  }
  const urlRe = /url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi;
  while ((m = urlRe.exec(t))) {
    if (!m[2]!.trim().startsWith("#")) return "SVG 的樣式參照了外部資源，為了安全只接受 url(#id) 形式。";
  }
  if (!/<svg[\s>]/.test(lower)) return "檔案內容不是有效的 SVG。";
  return null;
}

export type ValidatedAnimation = { format: AnimationFormat; ext: string; mime: string; svg?: SvgAnimInfo };

/** 驗證副檔名＋實際內容＋瀏覽器回報 MIME＋大小。不合格丟 AnimationValidationError（訊息可直接顯示給管理員）。 */
export function validateAnimationFile(input: { name: string; declaredType: string; data: Buffer }): ValidatedAnimation {
  const { name, declaredType, data } = input;
  if (!data.length) throw new AnimationValidationError("檔案是空的，請重新選擇。");
  const extMatch = /\.([a-z0-9]+)$/i.exec(name || "");
  const ext = (extMatch?.[1] ?? "").toLowerCase();
  if (!["mp4", "gif", "svg"].includes(ext)) {
    throw new AnimationValidationError(`不支援的檔案格式「${ext ? "." + ext : "無副檔名"}」。只接受 MP4、GIF、SVG。`);
  }
  const byName = ext as AnimationFormat;
  const actual = sniffFormat(data);
  if (!actual) throw new AnimationValidationError("檔案內容不是有效的 MP4、GIF 或 SVG（檔案可能損壞，或只是改了副檔名）。");
  if (actual !== byName) throw new AnimationValidationError(`副檔名是 .${ext}，但檔案實際內容是 ${actual.toUpperCase()}。請使用正確的檔案，不要只改副檔名。`);
  const declared = (declaredType || "").split(";")[0]!.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== FORMAT_MIME[actual]) {
    throw new AnimationValidationError(`檔案類型（${declared}）與內容不符，請重新匯出後再上傳。`);
  }
  if (data.length > ANIMATION_LIMITS[actual]) {
    throw new AnimationValidationError(`${actual.toUpperCase()} 檔案太大（${(data.length / 1024 / 1024).toFixed(2)} MB），上限是 ${fmtMB(ANIMATION_LIMITS[actual])}。請壓縮後再上傳。`);
  }
  if (actual === "svg") {
    const problem = checkSvgSafe(data.toString("utf8"));
    if (problem) throw new AnimationValidationError(problem);
    // 動畫 SVG 必須能判定結束時間且會停在最後狀態；無限循環／事件觸發／沒有 freeze 的一律拒絕
    const info = analyzeSvgAnimation(data.toString("utf8"));
    if (info.kind === "unsupported") throw new AnimationValidationError(info.reason);
    return { format: actual, ext: actual, mime: FORMAT_MIME[actual], svg: info };
  }
  return { format: actual, ext: actual, mime: FORMAT_MIME[actual] };
}
