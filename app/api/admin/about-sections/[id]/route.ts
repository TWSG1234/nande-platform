import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json();
  const updated = await prisma.aboutSection.update({
    where: { id: params.id },
    data: {
      titleZh: body.titleZh ?? undefined,
      titleEn: body.titleEn ?? undefined,
      contentZh: body.contentZh ?? undefined,
      contentEn: body.contentEn ?? undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
      isVisible: body.isVisible !== undefined ? Boolean(body.isVisible) : undefined,
    },
  });
  return NextResponse.json({ section: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  await prisma.aboutSection.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
