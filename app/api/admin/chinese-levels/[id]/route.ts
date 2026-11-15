import { snapshotImages, releaseChanged } from "@/lib/imageRefs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { toJsonFieldRequired, fromJsonField } from "@/lib/jsonFields";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const level = await prisma.chineseLevel.findUnique({ where: { id: params.id } });
  if (!level) return NextResponse.json({ error: "找不到這個關卡。" }, { status: 404 });

  // 編輯表單需要真正的物件/陣列，不是資料庫存的字串，這裡轉回來。
  return NextResponse.json({
    level: {
      ...level,
      drink: fromJsonField(level.drink, { liquid: "empty" }),
      vocabulary: fromJsonField(level.vocabulary, []),
      sentences: fromJsonField(level.sentences, []),
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.titleZh?.trim() || !body.level) {
    return NextResponse.json({ error: "請填寫關卡編號與主題名稱。" }, { status: 400 });
  }
  if (!Array.isArray(body.vocabulary) || body.vocabulary.length === 0) {
    return NextResponse.json({ error: "請至少保留一個中文詞彙。" }, { status: 400 });
  }
  if (!Array.isArray(body.sentences) || body.sentences.length === 0) {
    return NextResponse.json({ error: "請至少保留一句例句。" }, { status: 400 });
  }

  try {
    const imgBefore = await snapshotImages("chineseLevel", params.id, ["image"]);
    const updated = await prisma.chineseLevel.update({
      where: { id: params.id },
      data: {
        categoryId: body.categoryId,
        level: Number(body.level),
        titleZh: body.titleZh,
        titleEn: body.titleEn || body.titleZh,
        drink: toJsonFieldRequired(body.drink, { liquid: "empty" }),
        vocabulary: toJsonFieldRequired(body.vocabulary, []),
        sentences: toJsonFieldRequired(body.sentences, []),
        image: body.image || null,
        order: Number(body.order) || Number(body.level),
        isPublished: Boolean(body.isPublished),
      },
    });
    await releaseChanged(imgBefore, updated);
    return NextResponse.json({ level: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    const imgBeforeDel = await snapshotImages("chineseLevel", params.id, ["image"]);
    await prisma.chineseLevel.delete({ where: { id: params.id } });
    await releaseChanged(imgBeforeDel, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
