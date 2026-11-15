import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  try {
    const updated = await prisma.lifeItem.update({
      where: { id: params.id },
      data: {
        mobileOrder: body.mobileOrder === null || body.mobileOrder === "" ? null : Number(body.mobileOrder),
        mobileHidden: Boolean(body.mobileHidden),
      },
    });
    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
