import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const items = await prisma.lifeItem.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.id?.trim() || !body.titleZh?.trim() || !body.detailZh?.trim()) {
    return NextResponse.json({ error: "請填寫項目代碼、標題與簡短說明。" }, { status: 400 });
  }

  if (!/^[A-Za-z0-9-]+$/.test(body.id.trim())) {
    return NextResponse.json({ error: "項目代碼只能用英文字母、數字與 -。" }, { status: 400 });
  }
  const cat = body.categoryId ? await prisma.lifeCategory.findUnique({ where: { id: String(body.categoryId) }, select: { id: true } }) : null;
  if (!cat) return NextResponse.json({ error: "請先選擇一個分類（找不到你選的分類）。" }, { status: 400 });
  if (await prisma.lifeItem.findUnique({ where: { id: body.id.trim() }, select: { id: true } })) {
    return NextResponse.json({ error: "這個項目代碼已經被使用過了，請換一個。" }, { status: 400 });
  }

  try {
    const fullDetailZh = body.fullDetailZh || body.detailZh;
    const { values, enSourceJson } = await resolveBilingualFields({
      title: { zh: body.titleZh, en: body.titleEn, source: body.titleEnSource },
      detail: { zh: body.detailZh, en: body.detailEn, source: body.detailEnSource },
      fullDetail: { zh: fullDetailZh, en: body.fullDetailEn, source: body.fullDetailEnSource },
      tip: { zh: body.tipZh, en: body.tipEn, source: body.tipEnSource },
    });

    const created = await prisma.lifeItem.create({
      data: {
        id: body.id.trim(),
        categoryId: cat.id,
        titleZh: body.titleZh,
        titleEn: values.titleEn,
        detailZh: body.detailZh,
        detailEn: values.detailEn,
        fullDetailZh,
        fullDetailEn: values.fullDetailEn,
        tipZh: body.tipZh?.trim() ? body.tipZh : null,
        tipEn: body.tipZh?.trim() ? values.tipEn : null,
        enSource: enSourceJson,
        image: body.image || null,
        order: Number(body.order) || 0,
        isPublished: Boolean(body.isPublished),
      },
    });
    return NextResponse.json({ item: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
