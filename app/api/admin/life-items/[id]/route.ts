import { snapshotImages, releaseChanged, releaseImage } from "@/lib/imageRefs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";
import { fromJsonField } from "@/lib/jsonFields";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const item = await prisma.lifeItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "找不到這筆資料。" }, { status: 404 });

  const source = fromJsonField<Record<string, string>>(item.enSource, {});
  return NextResponse.json({
    item: {
      ...item,
      titleEnSource: source.titleEn,
      detailEnSource: source.detailEn,
      fullDetailEnSource: source.fullDetailEn,
      tipEnSource: source.tipEn,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();

  // 分類（選填；有帶才驗證與更新）。分類不存在就明確回報，不讓資料庫外鍵錯誤變成籠統的「儲存失敗」
  let categoryId: string | undefined;
  if (body.categoryId !== undefined && body.categoryId !== "") {
    const cat = await prisma.lifeCategory.findUnique({ where: { id: String(body.categoryId) }, select: { id: true } });
    if (!cat) return NextResponse.json({ error: "找不到你選的分類，請重新整理頁面後再試。" }, { status: 400 });
    categoryId = cat.id;
  }

  // 只改顯示／排序／分類（例如列表頁的「顯示中／已隱藏」切換）：不碰任何文字與英文欄位
  if (body.titleZh === undefined && body.detailZh === undefined) {
    try {
      const updated = await prisma.lifeItem.update({
        where: { id: params.id },
        data: {
          categoryId,
          isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
          order: body.order !== undefined ? Number(body.order) || 0 : undefined,
        },
      });
      return NextResponse.json({ item: updated });
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
    }
  }

  if (!body.titleZh?.trim() || !body.detailZh?.trim()) {
    return NextResponse.json({ error: "請填寫標題與簡短說明。" }, { status: 400 });
  }

  try {
    const fullDetailZh = body.fullDetailZh || body.detailZh;
    const { values, enSourceJson } = await resolveBilingualFields({
      title: { zh: body.titleZh, en: body.titleEn, source: body.titleEnSource },
      detail: { zh: body.detailZh, en: body.detailEn, source: body.detailEnSource },
      fullDetail: { zh: fullDetailZh, en: body.fullDetailEn, source: body.fullDetailEnSource },
      tip: { zh: body.tipZh, en: body.tipEn, source: body.tipEnSource },
    });
    const tipTouched = body.tipZh !== undefined;

    const imgBefore = await snapshotImages("lifeItem", params.id, ["image"]);
    const updated = await prisma.lifeItem.update({
      where: { id: params.id },
      data: {
        categoryId,
        titleZh: body.titleZh,
        titleEn: values.titleEn,
        detailZh: body.detailZh,
        detailEn: values.detailEn,
        fullDetailZh,
        fullDetailEn: values.fullDetailEn,
        // 小提示是選填：有送才更新；清空中文就一併清空英文
        tipZh: tipTouched ? (body.tipZh?.trim() ? body.tipZh : null) : undefined,
        tipEn: tipTouched ? (body.tipZh?.trim() ? values.tipEn : null) : undefined,
        enSource: enSourceJson,
        image: body.image || null,
        order: Number(body.order) || 0,
        isPublished: Boolean(body.isPublished),
      },
    });
    await releaseChanged(imgBefore, updated);
    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}


/** 順手清掉這個資訊框的裝飾圖片，圖片檔只有全站沒人用才移到 _trash。資料表不存在也沒關係。 */
async function removeDecor(scope: string, boxId: string) {
  try {
    const rows = await (prisma as any).infoBoxImage.findMany({ where: { scope, boxId }, select: { imageUrl: true } });
    await (prisma as any).infoBoxImage.deleteMany({ where: { scope, boxId } });
    for (const r of rows) await releaseImage(r.imageUrl);
  } catch {
    /* ignore */
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    const imgBeforeDel = await snapshotImages("lifeItem", params.id, ["image"]);
    await prisma.lifeItem.delete({ where: { id: params.id } });
    await removeDecor("life", params.id);
    await releaseChanged(imgBeforeDel, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
