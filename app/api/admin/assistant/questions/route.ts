import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { QUESTION_CATEGORIES, QUESTION_STATUSES } from "@/lib/ai/questions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/** 管理員：投稿列表（可依狀態、分類、提交時間篩選與排序）。需要登入。 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const category = sp.get("category") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const order = sp.get("order") === "old" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const where: Record<string, unknown> = {};
  if ((QUESTION_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (category === "none") where.category = "";
  else if ((QUESTION_CATEGORIES as readonly string[]).includes(category)) where.category = category;
  const range: Record<string, Date> = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) range.gte = new Date(`${from}T00:00:00+08:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) range.lte = new Date(`${to}T23:59:59.999+08:00`);
  if (Object.keys(range).length) where.createdAt = range;

  try {
    const [total, rows] = await Promise.all([
      prisma.assistantQuestion.count({ where }),
      prisma.assistantQuestion.findMany({
        where,
        orderBy: { createdAt: order },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { knowledge: { select: { id: true, status: true, isActive: true } } },
      }),
    ]);
    return NextResponse.json({ total, page, pageSize: PAGE_SIZE, questions: rows });
  } catch (err) {
    console.error("[admin-assistant-questions] list failed:", err);
    return NextResponse.json(
      { error: "讀取失敗。若這是第一次使用此功能，請先在專案資料夾執行 npm run db:update、再 npm run db:push（會自動備份、只新增兩張資料表）。", tableMissing: true },
      { status: 503 }
    );
  }
}
