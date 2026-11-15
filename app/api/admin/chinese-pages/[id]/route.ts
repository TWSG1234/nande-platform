import { releaseImage, snapshotImages, urlsFromComicJson } from "@/lib/imageRefs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  try {
    const imgBefore = await snapshotImages("chinesePage", params.id, ["comicImages", "comicImagesEn"]);
    const updated = await prisma.chinesePage.update({
      where: { id: params.id },
      data: {
        titleZh: body.titleZh ?? undefined,
        titleEn: body.titleEn ?? undefined,
        order: body.order !== undefined ? Number(body.order) : undefined,
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
        // comicImages 是這一頁全部漫畫圖片的 JSON 陣列，整批覆蓋式儲存——
        // 前端每次「新增/刪除/調整一張圖」都會把整個陣列重新送過來。
        comicImages: body.comicImages !== undefined ? JSON.stringify(body.comicImages) : undefined,
        // 英文版漫畫（獨立的一組圖）和「允許前台翻轉」開關——之前後台有送這兩個
        // 欄位，但這支 API 沒有接，所以上傳英文版漫畫後存檔等於沒存，重新載入
        // 就消失、翻轉功能也永遠打不開。
        comicImagesEn: body.comicImagesEn !== undefined ? JSON.stringify(body.comicImagesEn) : undefined,
        allowFlip: body.allowFlip !== undefined ? Boolean(body.allowFlip) : undefined,
      },
    });
    // 漫畫圖片被拿掉的網址（逐張刪除／整組覆蓋）：確認沒有其他地方在用才移到 _trash
    const keep = new Set([...urlsFromComicJson(updated.comicImages), ...urlsFromComicJson(updated.comicImagesEn)]);
    for (const u of [...urlsFromComicJson(imgBefore.comicImages), ...urlsFromComicJson(imgBefore.comicImagesEn)]) {
      if (!keep.has(u)) await releaseImage(u, null);
    }
    return NextResponse.json({ page: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    const imgBefore = await snapshotImages("chinesePage", params.id, ["comicImages", "comicImagesEn"]);
    await prisma.chinesePage.delete({ where: { id: params.id } });
    for (const u of [...urlsFromComicJson(imgBefore.comicImages), ...urlsFromComicJson(imgBefore.comicImagesEn)]) await releaseImage(u, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
