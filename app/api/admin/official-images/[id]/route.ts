import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { deleteLocalImage } from "@/lib/uploadImage";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const image = await prisma.officialImage.findUnique({ where: { id: params.id } });
  if (!image) return NextResponse.json({ error: "找不到這張圖片。" }, { status: 404 });
  return NextResponse.json({ image });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const existing = await prisma.officialImage.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "找不到這張圖片。" }, { status: 404 });

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "請填寫圖片名稱。" }, { status: 400 });
  }

  // 如果這次是「替換圖片」（傳進來一個跟現有不一樣的 url），先把舊的實體檔案刪掉，
  // 避免累積一堆不會再用到的舊圖檔。這張表本身沒有被其他 model 引用，所以刪除
  // 舊檔案是安全的，不會讓別的頁面的圖片消失。
  const isReplacingFile = body.url && body.url !== existing.url;

  try {
    const updated = await prisma.officialImage.update({
      where: { id: params.id },
      data: {
        url: body.url || existing.url,
        title: body.title,
        category: body.category || "other",
        usage: body.usage || null,
        isActive: body.isActive ?? existing.isActive,
      },
    });

    if (isReplacingFile) {
      await deleteLocalImage(existing.url);
    }

    return NextResponse.json({ image: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const existing = await prisma.officialImage.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "找不到這張圖片。" }, { status: 404 });

  try {
    await prisma.officialImage.delete({ where: { id: params.id } });
    await deleteLocalImage(existing.url); // 資料庫紀錄跟實體檔案一起清掉，不留孤兒檔案
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
