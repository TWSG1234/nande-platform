import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { deleteCategory } from "@/lib/categoryDelete";
import { resolveBilingualFields } from "@/lib/translationService";
import { fromJsonField } from "@/lib/jsonFields";

const unauthorized = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauthorized();
  const category = await prisma.lifeCategory.findUnique({ where: { id: params.id } });
  if (!category) return NextResponse.json({ error: "找不到這個分類。" }, { status: 404 });
  const source = fromJsonField<Record<string, string>>(category.enSource, {});
  return NextResponse.json({ category: { ...category, nameEnSource: source.nameEn, descriptionEnSource: source.descriptionEn } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauthorized();
  const body = await req.json();

  // 只改顯示／排序（不碰文字與英文）
  if (body.nameZh === undefined) {
    try {
      const updated = await prisma.lifeCategory.update({
        where: { id: params.id },
        data: {
          isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
          order: body.order !== undefined ? Number(body.order) || 0 : undefined,
        },
      });
      return NextResponse.json({ category: updated });
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
    }
  }

  if (!body.nameZh?.trim()) return NextResponse.json({ error: "請填寫分類名稱。" }, { status: 400 });
  try {
    const { values, enSourceJson } = await resolveBilingualFields({
      name: { zh: body.nameZh, en: body.nameEn, source: body.nameEnSource },
      description: { zh: body.descriptionZh, en: body.descriptionEn, source: body.descriptionEnSource },
    });
    const updated = await prisma.lifeCategory.update({
      where: { id: params.id },
      data: {
        nameZh: body.nameZh,
        nameEn: values.nameEn,
        descriptionZh: body.descriptionZh || "",
        descriptionEn: values.descriptionEn,
        icon: body.icon || undefined,
        enSource: enSourceJson,
        order: body.order !== undefined ? Number(body.order) || 0 : undefined,
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
      },
    });
    return NextResponse.json({ category: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

/** 刪除分類：底下還有項目時必須選擇 ?mode=move&to=<分類id> 或 ?mode=cascade（詳見 lib/categoryDelete.ts）。 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauthorized();
  const u = new URL(req.url);
  const r = await deleteCategory("life", params.id, u.searchParams.get("mode"), u.searchParams.get("to"));
  return NextResponse.json(r.body, { status: r.status });
}
