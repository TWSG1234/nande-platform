import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json();
  const updated = await prisma.ipDialogueLine.update({
    where: { id: params.id },
    data: {
      textZh: body.textZh ?? undefined,
      textEn: body.textEn ?? undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
      isEnabled: body.isEnabled !== undefined ? Boolean(body.isEnabled) : undefined,
    },
  });
  return NextResponse.json({ line: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  await prisma.ipDialogueLine.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
