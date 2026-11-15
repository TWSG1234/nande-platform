import { NextRequest, NextResponse } from "next/server";
import { getStageAnimation, validStageId, versionOf } from "@/lib/chinese/correctAnimationDb";
import { analyzeSvgAnimation } from "@/lib/chinese/svgAnim";
import { getStorage } from "@/lib/storage";

// 前台用：「這一關」要播哪一種答對動畫。不需登入、只回傳公開資訊（格式與播放網址），不回傳檔名或內部路徑。
// 每次都即時讀資料庫（no-store），後台更換後前台立刻套用。沒有設定 → { mode: "none" }（成功彈窗只顯示文字／圖示）。
// SVG 另外回傳「動畫長度」：動畫 SVG 必須能判定結束時間、且會停在最後狀態；不符合的舊檔（例如無限循環）前台不播放。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stageId = new URL(req.url).searchParams.get("stageId");
  let a: Awaited<ReturnType<typeof getStageAnimation>> = null;
  try {
    a = validStageId(stageId) ? await getStageAnimation(stageId) : null;
  } catch (err) {
    console.error("[chinese-animation] 讀取設定暫時失敗：", (err as Error)?.message);
    return NextResponse.json({ error: "temporary" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const none = () => NextResponse.json({ mode: "none" }, { headers: { "Cache-Control": "no-store" } });
  if (!a) return none();
  // 資料庫有設定、但檔案已經不在固定資料夾（被搬走／刪除）：不要回傳一個播不出來的網址，改成「沒有動畫」，並在伺服器記錄原因。
  if (!(await getStorage().exists(a.fileUrl).catch(() => false))) {
    console.warn(`[chinese-animation] 關卡 ${a.stageId} 的動畫檔案找不到（${a.fileUrl}），請到後台重新上傳。`);
    return none();
  }
  const body: Record<string, unknown> = {
    mode: "custom",
    format: a.format,
    src: `/api/chinese/correct-animation/file?stageId=${encodeURIComponent(a.stageId)}&v=${versionOf(a)}`,
  };
  if (a.format === "svg") {
    const data = await getStorage().read(a.fileUrl).catch(() => null);
    if (!data) return none();
    const info = analyzeSvgAnimation(data.toString("utf8"));
    if (info.kind === "unsupported") return none();
    body.svgMs = info.durationMs;
  }
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
