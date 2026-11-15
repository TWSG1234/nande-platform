import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json();
  if (!body.characterId || !body.textZh?.trim()) {
    return NextResponse.json({ error: "請填寫中文回覆內容。" }, { status: 400 });
  }
  const created = await prisma.ipDialogueLine.create({
    data: {
      characterId: body.characterId,
      textZh: body.textZh,
      textEn: body.textEn || "",
      order: Number(body.order) || 0,
      isEnabled: body.isEnabled ?? true,
    },
  });
  return NextResponse.json({ line: created });
}
