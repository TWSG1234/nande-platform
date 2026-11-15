import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const members = await prisma.teamMember.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json();
  if (!body.nameZh?.trim()) return NextResponse.json({ error: "請填寫姓名。" }, { status: 400 });
  const created = await prisma.teamMember.create({
    data: {
      nameZh: body.nameZh,
      nameEn: body.nameEn || "",
      roleZh: body.roleZh || "",
      roleEn: body.roleEn || "",
      bioZh: body.bioZh || "",
      bioEn: body.bioEn || "",
      photo: body.photo || null,
      order: Number(body.order) || 0,
      isVisible: body.isVisible ?? true,
    },
  });
  return NextResponse.json({ member: created });
}
