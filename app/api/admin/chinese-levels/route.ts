import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { toJsonFieldRequired, fromJsonField } from "@/lib/jsonFields";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const levels = await prisma.chineseLevel.findMany({
    orderBy: [{ categoryId: "asc" }, { level: "asc" }],
  });
  // 清單頁只用得到 titleZh/level 等欄位，這裡不需要把 drink/vocabulary/sentences
  // 轉回物件，保留字串即可（減少不必要的處理）。
  return NextResponse.json({ levels });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.id?.trim() || !body.categoryId?.trim() || !body.titleZh?.trim() || !body.level) {
    return NextResponse.json({ error: "請填寫分類、關卡編號與主題名稱。" }, { status: 400 });
  }
  if (!Array.isArray(body.vocabulary) || body.vocabulary.length === 0) {
    return NextResponse.json({ error: "請至少新增一個中文詞彙。" }, { status: 400 });
  }
  if (!Array.isArray(body.sentences) || body.sentences.length === 0) {
    return NextResponse.json({ error: "請至少新增一句例句。" }, { status: 400 });
  }

  try {
    const created = await prisma.chineseLevel.create({
      data: {
        id: body.id.trim(),
        categoryId: body.categoryId,
        level: Number(body.level),
        titleZh: body.titleZh,
        titleEn: body.titleEn || body.titleZh,
        drink: toJsonFieldRequired(body.drink, { liquid: "empty" }),
        vocabulary: toJsonFieldRequired(body.vocabulary, []),
        sentences: toJsonFieldRequired(body.sentences, []),
        image: body.image || null,
        order: Number(body.order) || Number(body.level),
        isPublished: Boolean(body.isPublished),
      },
    });
    return NextResponse.json({ level: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，這個關卡代碼可能已經被使用過了。" }, { status: 400 });
  }
}
