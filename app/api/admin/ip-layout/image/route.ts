import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { releaseChanged } from "@/lib/imageRefs";
import { IP_CHAR_IDS, IpCharId } from "@/lib/home/ipLayout";
import { IP_IMAGE_FIELD, isSafeImageUrl } from "@/lib/home/ipImages";

/**
 * 更換（或恢復內建）某隻首頁角色的外觀圖片。
 * 只改「網站外觀 → IP角色 N」那一個欄位（前台首頁實際讀取的就是這個欄位）；
 * 角色的位置、大小、角度在另一張表，完全不受影響。舊圖片只有在全站沒有其他地方使用時才會移到 uploads/_trash。
 * body：{ characterId, url }；url 為空字串＝恢復內建圖片。
 */
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "送出的內容無法讀取。" }, { status: 400 });
  }
  const id = body.characterId as IpCharId;
  if (!IP_CHAR_IDS.includes(id)) return NextResponse.json({ error: "找不到這個角色位置。" }, { status: 400 });
  const raw = body.url;
  const url = raw === "" || raw === null ? null : raw;
  if (url !== null && !isSafeImageUrl(url)) return NextResponse.json({ error: "圖片網址不正確，請重新上傳圖片。" }, { status: 400 });

  const field = IP_IMAGE_FIELD[id];
  try {
    const existing = await prisma.siteSetting.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
    const updated = await prisma.siteSetting.update({ where: { id: "default" }, data: { [field]: url } });
    await releaseChanged({ [field]: (existing as Record<string, unknown>)[field] as string | null }, updated);
    return NextResponse.json({ characterId: id, url: (updated as Record<string, unknown>)[field] ?? null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存圖片失敗，請稍後再試一次。" }, { status: 500 });
  }
}
