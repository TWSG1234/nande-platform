import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { cleanText, LIMITS, QUESTION_STATUSES } from "@/lib/ai/questions";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauthorized();
  const q = await prisma.assistantQuestion.findUnique({ where: { id: params.id }, include: { knowledge: true } });
  if (!q) return NextResponse.json({ error: "找不到這筆投稿。" }, { status: 404 });
  return NextResponse.json({ question: q });
}

/** 管理員：改處理狀態、整理標準問法、內部備註。原始問題（question）不會被修改。 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "資料格式錯誤。" }, { status: 400 });
  }
  const data: Record<string, string> = {};
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !(QUESTION_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "狀態不正確。" }, { status: 400 });
    }
    // 「已建立知識」只能由「建立知識」動作設定，避免狀態和知識內容不一致
    if (body.status === "knowledge_created") return NextResponse.json({ error: "請用「建立並啟用知識」來標記為已建立知識。" }, { status: 400 });
    data.status = body.status;
  }
  if (body.standardQuestion !== undefined) data.standardQuestion = cleanText(body.standardQuestion, LIMITS.standard);
  if (body.adminNote !== undefined) data.adminNote = cleanText(body.adminNote, LIMITS.adminNote);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "沒有要更新的內容。" }, { status: 400 });
  try {
    let q = await prisma.assistantQuestion.update({ where: { id: params.id }, data, include: { knowledge: true } });
    // 標為「暫不採用」時，若已有啟用中的知識，一併停用，避免不採用的內容還被搜尋到
    if (data.status === "rejected" && q.knowledge?.isActive) {
      await prisma.assistantKnowledge.update({ where: { id: q.knowledge.id }, data: { isActive: false } });
      q = (await prisma.assistantQuestion.findUnique({ where: { id: params.id }, include: { knowledge: true } }))!;
    }
    return NextResponse.json({ question: q });
  } catch {
    return NextResponse.json({ error: "找不到這筆投稿或儲存失敗。" }, { status: 404 });
  }
}
