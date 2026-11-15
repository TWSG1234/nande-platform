import { snapshotImages, releaseChanged } from "@/lib/imageRefs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json();
  const imgBefore = await snapshotImages("partner", params.id, ["logo"]);
  const updated = await prisma.partner.update({
    where: { id: params.id },
    data: {
      nameZh: body.nameZh ?? undefined,
      nameEn: body.nameEn ?? undefined,
      descriptionZh: body.descriptionZh ?? undefined,
      descriptionEn: body.descriptionEn ?? undefined,
      logo: body.logo !== undefined ? body.logo || null : undefined, // 空字串／null＝清空圖片
      websiteUrl: body.websiteUrl ?? undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
      isVisible: body.isVisible !== undefined ? Boolean(body.isVisible) : undefined,
    },
  });
  await releaseChanged(imgBefore, updated);
  return NextResponse.json({ partner: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const imgBeforeDel = await snapshotImages("partner", params.id, ["logo"]);
  await prisma.partner.delete({ where: { id: params.id } });
  await releaseChanged(imgBeforeDel, {});
  return NextResponse.json({ ok: true });
}
