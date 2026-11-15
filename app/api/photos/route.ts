import { NextResponse } from "next/server";
import { getApprovedPhotos } from "@/lib/publicPhotos";

// 每次請求都即時查詢資料庫：核准／退回／刪除投稿後，照片牆要立刻反映。
// 沒有這行時 Next.js 會在 build 階段把結果存成靜態檔（build 結果顯示 ○），之後核准的照片要重新部署才看得到。
export const dynamic = "force-dynamic";

export async function GET() {
  const photos = await getApprovedPhotos();
  return NextResponse.json({ photos });
}
