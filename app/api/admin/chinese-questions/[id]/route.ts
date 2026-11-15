import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  try {
    const updated = await prisma.chineseQuestion.update({
      where: { id: params.id },
      data: {
        promptZh: body.promptZh ?? undefined,
        promptEn: body.promptEn ?? undefined,
        answerData: body.answerData ?? undefined,
        hintZh: body.hintZh ?? undefined,
        hintEn: body.hintEn ?? undefined,
        explanationZh: body.explanationZh ?? undefined,
        explanationEn: body.explanationEn ?? undefined,
        order: body.order !== undefined ? Number(body.order) : undefined,
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
      },
    });
    return NextResponse.json({ question: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    await prisma.chineseQuestion.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
