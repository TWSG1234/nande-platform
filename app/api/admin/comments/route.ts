import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const comments = await prisma.comment.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: { photo: { select: { title: true } } },
  });
  return NextResponse.json({ comments });
}
