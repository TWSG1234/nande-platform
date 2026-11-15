import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const sections = await prisma.aboutSection.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ sections });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json();
  const created = await prisma.aboutSection.create({
    data: {
      titleZh: body.titleZh || "",
      titleEn: body.titleEn || "",
      contentZh: body.contentZh || "",
      contentEn: body.contentEn || "",
      order: Number(body.order) || 0,
      isVisible: body.isVisible ?? true,
    },
  });
  return NextResponse.json({ section: created });
}
