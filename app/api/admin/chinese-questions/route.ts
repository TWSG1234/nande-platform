import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.pageId || !body.questionType) {
    return NextResponse.json({ error: "缺少必要欄位。" }, { status: 400 });
  }

  try {
    const created = await prisma.chineseQuestion.create({
      data: {
        pageId: body.pageId,
        questionType: body.questionType,
        promptZh: body.promptZh || "",
        promptEn: body.promptEn || "",
        answerData: body.answerData || "",
        hintZh: body.hintZh || "",
        hintEn: body.hintEn || "",
        explanationZh: body.explanationZh || "",
        explanationEn: body.explanationEn || "",
        order: Number(body.order) || 0,
        isPublished: body.isPublished ?? true,
      },
    });
    return NextResponse.json({ question: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
