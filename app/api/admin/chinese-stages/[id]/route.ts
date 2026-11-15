import { releaseImage, urlsFromComicJson } from "@/lib/imageRefs";
import { getStageAnimation, deleteStageAnimation } from "@/lib/chinese/correctAnimationDb";
import { getStorage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const stage = await prisma.chineseStage.findUnique({
    where: { id: params.id },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: {
          words: { orderBy: { order: "asc" } },
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!stage) return NextResponse.json({ error: "找不到這個關卡。" }, { status: 404 });
  return NextResponse.json({ stage });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  try {
    const updated = await prisma.chineseStage.update({
      where: { id: params.id },
      data: {
        titleZh: body.titleZh ?? undefined,
        titleEn: body.titleEn ?? undefined,
        order: body.order !== undefined ? Number(body.order) : undefined,
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
      },
    });
    return NextResponse.json({ stage: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    // 刪除關卡會連同頁面一起刪除：先記下這一關漫畫用到的圖片，刪除後逐張確認沒人在用再清理
    const pagesBefore = await prisma.chinesePage.findMany({ where: { stageId: params.id }, select: { comicImages: true, comicImagesEn: true } }).catch(() => []);
    await prisma.chineseStage.delete({ where: { id: params.id } });
    for (const pg of pagesBefore) for (const u of [...urlsFromComicJson(pg.comicImages), ...urlsFromComicJson(pg.comicImagesEn)]) await releaseImage(u, null);
    // 順手清理這一關的答題成功動畫（檔案移到 _trash）。失敗不影響刪除關卡。
    try {
      const anim = await getStageAnimation(params.id);
      if (anim) {
        await deleteStageAnimation(params.id);
        await getStorage().remove(anim.fileUrl);
      }
    } catch (e) {
      console.warn("[chinese-stages] 清理關卡動畫失敗（可忽略）：", (e as Error)?.message);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
