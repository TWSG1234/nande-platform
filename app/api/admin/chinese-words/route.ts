import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.pageId || !body.hanzi?.trim()) {
    return NextResponse.json({ error: "請填寫中文。" }, { status: 400 });
  }

  try {
    const created = await prisma.chineseVocabWord.create({
      data: {
        pageId: body.pageId,
        hanzi: body.hanzi,
        pinyin: body.pinyin || "",
        english: body.english || "",
        order: Number(body.order) || 0,
      },
    });
    return NextResponse.json({ word: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
