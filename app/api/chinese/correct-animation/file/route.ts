import { NextRequest, NextResponse } from "next/server";
import { getStageAnimation, validStageId } from "@/lib/chinese/correctAnimationDb";
import { FORMAT_MIME } from "@/lib/chinese/correctAnimation";
import { getStorage } from "@/lib/storage";

// 只提供「某一關目前設定的那一個動畫檔」（以關卡 ID 查資料庫），不接受任何檔名／路徑參數，所以不可能被用來讀其他檔案。
// 一般的 /uploads 路由仍然只開放圖片（不含 svg/mp4）。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stageId = new URL(req.url).searchParams.get("stageId");
  let s: Awaited<ReturnType<typeof getStageAnimation>> = null;
  try {
    s = validStageId(stageId) ? await getStageAnimation(stageId) : null;
  } catch (err) {
    console.error("[chinese-animation] 讀取設定暫時失敗：", (err as Error)?.message);
    return new NextResponse("Temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!s) return new NextResponse("Not found", { status: 404 });
  const data = await getStorage().read(s.fileUrl).catch(() => null);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": FORMAT_MIME[s.format],
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Accept-Ranges": "bytes",
  };
  if (s.format === "svg") {
    // 就算有人直接開啟這個網址，也不能執行腳本或載入外部資源。
    headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
  }

  // MP4 需要支援 Range（Safari／iOS 沒有 Range 無法播放影片）
  const range = req.headers?.get?.("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] || m[2])) {
    const size = data.length;
    let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2]!, 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const part = data.subarray(start, end + 1);
    return new NextResponse(part, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(part.length) } });
  }
  return new NextResponse(data, { headers: { ...headers, "Content-Length": String(data.length) } });
}
