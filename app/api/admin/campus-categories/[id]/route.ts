import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";
import { deleteCategory } from "@/lib/categoryDelete";

export const dynamic = "force-dynamic";
const db = () => (prisma as any).campusCategory;
const unauth = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauth();
  const body = await req.json().catch(() => ({}));
  try {
    const cur = await db().findUnique({ where: { id: params.id } });
    if (!cur) return NextResponse.json({ error: "找不到這個分類。" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (typeof body.isPublished === "boolean") data.isPublished = body.isPublished;
    if (body.nameZh !== undefined || body.descriptionZh !== undefined) {
      if (!String(body.nameZh ?? cur.nameZh).trim()) return NextResponse.json({ error: "分類名稱不能空白。" }, { status: 400 });
      const { values, enSourceJson } = await resolveBilingualFields({
        name: { zh: body.nameZh ?? cur.nameZh, en: body.nameEn ?? cur.nameEn, source: body.nameEnSource },
        description: { zh: body.descriptionZh ?? cur.descriptionZh, en: body.descriptionEn ?? cur.descriptionEn, source: body.descriptionEnSource },
      });
      Object.assign(data, { nameZh: body.nameZh ?? cur.nameZh, nameEn: values.nameEn, descriptionZh: body.descriptionZh ?? cur.descriptionZh, descriptionEn: values.descriptionEn, enSource: enSourceJson });
    }
    const category = await db().update({ where: { id: params.id }, data }); // 只改有送來的欄位；id 不會變，所以底下的資訊框不會錯位
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

/** 刪除分類。底下還有資訊框時必須指定 ?mode=move&to=<分類id>（先移動）或 ?mode=cascade（連同資訊框一起刪），否則回 409 並說明。 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauth();
  const u = new URL(req.url);
  const r = await deleteCategory("campus", params.id, u.searchParams.get("mode"), u.searchParams.get("to"));
  return NextResponse.json(r.body, { status: r.status });
}
