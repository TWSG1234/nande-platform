import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 管理員：已建立的知識清單（含草稿與已停用）。需要登入。 */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  try {
    const knowledge = await prisma.assistantKnowledge.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    return NextResponse.json({ knowledge });
  } catch {
    return NextResponse.json({ error: "讀取失敗，請先執行 npm run db:push。", tableMissing: true }, { status: 503 });
  }
}
