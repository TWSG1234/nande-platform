import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { parseSchoolTimesText } from "@/lib/schoolTimes";
import { toJsonField } from "@/lib/jsonFields";
import { resolveBilingualFields } from "@/lib/translationService";
import { resolveCampusCategoryId } from "@/lib/campusCategories";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const spots = await prisma.campusSpot.findMany({ orderBy: [{ order: "asc" }] });
  return NextResponse.json({ spots });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.id?.trim() || !body.nameZh?.trim() || !body.descriptionZh?.trim()) {
    return NextResponse.json({ error: "請填寫項目代碼、標題與介紹。" }, { status: 400 });
  }

  if (!/^[A-Za-z0-9-]+$/.test(body.id.trim())) {
    return NextResponse.json({ error: "項目代碼只能用英文字母、數字與 -（不可有空白或中文）。" }, { status: 400 });
  }
  const categoryId = await resolveCampusCategoryId(prisma, body.category ?? "culture");
  if (!categoryId) return NextResponse.json({ error: "分類不正確，請重新選擇。" }, { status: 400 });

  try {
    const { values, enSourceJson } = await resolveBilingualFields({
      name: { zh: body.nameZh, en: body.nameEn, source: body.nameEnSource },
      description: { zh: body.descriptionZh, en: body.descriptionEn, source: body.descriptionEnSource },
      details: { zh: body.detailsZh, en: body.detailsEn, source: body.detailsEnSource },
      mainResponsibility: {
        zh: body.mainResponsibilityZh,
        en: body.mainResponsibilityEn,
        source: body.mainResponsibilityEnSource,
      },
    });
    const created = await prisma.campusSpot.create({
      data: {
        id: body.id.trim(),
        category: categoryId,
        image: body.image || null,
        nameZh: body.nameZh,
        nameEn: values.nameEn,
        descriptionZh: body.descriptionZh,
        descriptionEn: values.descriptionEn,
        detailsZh: body.detailsZh || null,
        detailsEn: values.detailsEn || null,
        schoolTimes: parseSchoolTimesText(body.schoolTimesText).length
          ? JSON.stringify(parseSchoolTimesText(body.schoolTimesText))
          : null,
        mainResponsibilityZh: body.mainResponsibilityZh || null,
        mainResponsibilityEn: values.mainResponsibilityEn || null,
        enSource: enSourceJson,
        exchangeStudentMayEncounter: toJsonField(body.exchangeStudentMayEncounter),
        order: Number(body.order) || 0,
        isPublished: Boolean(body.isPublished),
      },
    });
    return NextResponse.json({ spot: created });
  } catch (err: unknown) {
    const msg =
      typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002"
        ? "這個項目代碼已經被使用過了，請換一個。"
        : "儲存失敗，請稍後再試一次。";
    console.error(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
