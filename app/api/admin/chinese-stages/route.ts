import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const track = req.nextUrl.searchParams.get("track");
  const stages = await prisma.chineseStage.findMany({
    where: track ? { track } : {},
    orderBy: [{ track: "asc" }, { order: "asc" }, { levelNumber: "asc" }],
  });
  return NextResponse.json({ stages });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  const track = body.track === "campus" ? "campus" : "life";
  if (!body.levelNumber) {
    return NextResponse.json({ error: "請填寫關卡編號。" }, { status: 400 });
  }

  try {
    const created = await prisma.chineseStage.create({
      data: {
        track,
        levelNumber: Number(body.levelNumber),
        titleZh: body.titleZh || "",
        titleEn: body.titleEn || "",
        order: Number(body.order) || Number(body.levelNumber),
        isPublished: body.isPublished ?? true,
      },
    });
    return NextResponse.json({ stage: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
