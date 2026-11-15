import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const images = await prisma.officialImage.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ images });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.url?.trim() || !body.title?.trim()) {
    return NextResponse.json({ error: "請上傳圖片並填寫圖片名稱。" }, { status: 400 });
  }

  try {
    const created = await prisma.officialImage.create({
      data: {
        url: body.url,
        title: body.title,
        category: body.category || "other",
        usage: body.usage || null,
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json({ image: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
