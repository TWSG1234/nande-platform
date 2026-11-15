import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const partners = await prisma.partner.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ partners });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json();
  if (!body.nameZh?.trim()) return NextResponse.json({ error: "請填寫合作單位名稱。" }, { status: 400 });
  const created = await prisma.partner.create({
    data: {
      nameZh: body.nameZh,
      nameEn: body.nameEn || "",
      descriptionZh: body.descriptionZh || "",
      descriptionEn: body.descriptionEn || "",
      logo: body.logo || null,
      websiteUrl: body.websiteUrl || "",
      order: Number(body.order) || 0,
      isVisible: body.isVisible ?? true,
    },
  });
  return NextResponse.json({ partner: created });
}
