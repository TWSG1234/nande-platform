import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["comic", "vocabulary", "fill_blank", "multiple_choice", "matching", "true_false"];

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.stageId || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "請選擇關卡與頁面類型。" }, { status: 400 });
  }

  try {
    const created = await prisma.chinesePage.create({
      data: {
        stageId: body.stageId,
        type: body.type,
        titleZh: body.titleZh || "",
        titleEn: body.titleEn || "",
        order: Number(body.order) || 0,
        isPublished: true,
        comicImages: body.type === "comic" ? "[]" : null,
      },
    });
    return NextResponse.json({ page: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
