import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getDataConfig } from "@/lib/config/dataConfig";
import { IMAGE_EXTENSIONS, realFileInside, resolveUploadFile } from "@/lib/storage/localPath";
import { cloudStorage, cloudinaryDeliveryUrl, getStorageDriver } from "@/lib/storage";

// 讀取上傳圖片。對外網址仍是 /uploads/...（next.config.js 轉到這裡），所以資料庫裡的圖片路徑完全不用改。
//
// 順序（STORAGE_DRIVER=cloudinary 時）：
//   1. 先找固定資料夾裡有沒有這個檔案 → 有就直接提供（舊的本機圖片完全不受影響，不會被搬動或刪除）
//   2. 沒有 → 向 Cloudinary 的 https Secure URL 取圖後回傳（proxy，預設）或轉址（redirect，見下）
// STORAGE_DRIVER=local 時只讀固定資料夾；若另外設 CLOUDINARY_FALLBACK=1（並設好 Cloudinary 環境變數），
// 本機找不到的檔案（例如在 cloudinary 模式期間上傳的）也會轉址到 Cloudinary，切回本機模式時圖片不會消失。
// 安全：只回傳副檔名在圖片白名單內的檔案；擋 ..、反斜線、符號連結、_trash 等內部資料夾；一般路由不開放動畫檔（mp4／svg）。
export const dynamic = "force-dynamic";

const decodeSegs = (p: string[] | undefined) =>
  (p ?? []).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return "";
    }
  });

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const segments = decodeSegs(params.path);
  const cfg = getDataConfig();

  // 1. 本機檔案（兩種模式都先找）
  if (cfg.uploadsDir) {
    const target = resolveUploadFile(cfg.uploadsDir, segments);
    const real = target && realFileInside(cfg.uploadsDir, target);
    if (real) {
      const data = await readFile(real);
      return new NextResponse(data, {
        headers: {
          "Content-Type": IMAGE_EXTENSIONS[path.extname(real).toLowerCase()] ?? "application/octet-stream",
          "Content-Length": String(data.length),
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "inline",
        },
      });
    }
  }

  // 2. Cloudinary
  const useCloud = getStorageDriver() === "cloudinary" || process.env.CLOUDINARY_FALLBACK === "1";
  // 只有「通過同一套安全規則、且是圖片」的路徑才會處理；動畫檔／_trash／穿越路徑一律 404。
  if (useCloud && segments.length >= 2 && segments.length <= 6 && resolveUploadFile("/virtual-root", segments)) {
    let url: string | null = null;
    try {
      url = await cloudinaryDeliveryUrl("/uploads/" + segments.map(encodeURIComponent).join("/"));
    } catch (e) {
      console.error("[files] Cloudinary 設定錯誤：", (e as Error)?.message);
      return new NextResponse("Storage not configured", { status: 503 });
    }
    if (url) {
      // 預設 proxy：由伺服器向 Cloudinary 取圖再回傳。這樣 <img>、CSS 背景以及 next/image 最佳化（它不會跟隨轉址）都能正常顯示。
      // CLOUDINARY_DELIVERY_MODE=redirect：改成 302 轉址到 Secure URL（省伺服器流量，但 next/image 載入 /uploads 圖片會失敗，請先確認）。
      if ((process.env.CLOUDINARY_DELIVERY_MODE || "proxy").toLowerCase() === "redirect") {
        return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "public, max-age=300" } });
      }
      try {
        // 經過驅動的 read()：遇到 CDN 快取的 404 時會用 Admin API 確認並改用帶版本號的網址。
        const data = await cloudStorage.read("/uploads/" + segments.map(encodeURIComponent).join("/"));
        if (!data) return new NextResponse("Not found", { status: 404 });
        return new NextResponse(new Uint8Array(data), {
          headers: {
            // 內容類型由我們依副檔名決定，不採用上游回傳的值
            "Content-Type": IMAGE_EXTENSIONS[path.extname(segments[segments.length - 1]!).toLowerCase()] ?? "application/octet-stream",
            "Content-Length": String(data.length),
            // 檔名是 UUID、不會被覆蓋，可長期快取
            "Cache-Control": "public, max-age=86400, s-maxage=31536000",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
          },
        });
      } catch (e) {
        console.error("[files] 向 Cloudinary 取圖失敗：", (e as Error)?.message);
        return new NextResponse("Upstream unavailable", { status: 502 });
      }
    }
  }
  return new NextResponse("Not found", { status: 404 });
}
