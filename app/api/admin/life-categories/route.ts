import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const categories = await prisma.lifeCategory.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.id?.trim() || !body.nameZh?.trim()) {
    return NextResponse.json({ error: "請填寫分類代碼與名稱。" }, { status: 400 });
  }

  if (!/^[A-Za-z0-9-]+$/.test(body.id.trim())) {
    return NextResponse.json({ error: "分類代碼只能用英文字母、數字與 -。" }, { status: 400 });
  }
  if (await prisma.lifeCategory.findUnique({ where: { id: body.id.trim() }, select: { id: true } })) {
    return NextResponse.json({ error: "這個分類代碼已經被使用過了，請換一個。" }, { status: 400 });
  }

  try {
    const { values, enSourceJson } = await resolveBilingualFields({
      name: { zh: body.nameZh, en: body.nameEn, source: body.nameEnSource },
      description: { zh: body.descriptionZh, en: body.descriptionEn, source: body.descriptionEnSource },
    });

    const created = await prisma.lifeCategory.create({
      data: {
        id: body.id.trim(),
        nameZh: body.nameZh,
        nameEn: values.nameEn,
        icon: body.icon || "Lightbulb",
        descriptionZh: body.descriptionZh || "",
        descriptionEn: values.descriptionEn,
        enSource: enSourceJson,
        order: Number(body.order) || 0,
        isPublished: Boolean(body.isPublished),
      },
    });
    return NextResponse.json({ category: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
