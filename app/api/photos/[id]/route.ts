import { NextRequest, NextResponse } from "next/server";
import { getApprovedPhoto } from "@/lib/publicPhotos";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const photo = await getApprovedPhoto(params.id);
  if (!photo) {
    // 故意用 404，不透露「這張照片其實存在，只是還在審核」這種資訊——一般
    // 訪客沒有必要知道 PENDING/REJECTED 投稿的存在。
    return NextResponse.json({ error: "找不到這張照片。" }, { status: 404 });
  }
  return NextResponse.json({ photo });
}
