import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { cleanSourceUrl, cleanText, LIMITS, QUESTION_CATEGORIES } from "@/lib/ai/questions";

export const dynamic = "force-dynamic";

/**
 * 管理員：由一筆投稿建立／修改「正式知識」。
 * action：
 *  draft   儲存草稿（不會被搜尋）
 *  approve 核准並啟用（標準問題與正式答案必填；之後威洛搜尋得到）
 *  disable 停用（立刻不再被搜尋，內容保留）
 *  enable  重新啟用（必須是已核准的知識）
 * 投稿本身（原始問題）不會被修改，也不會因為投稿存在就被搜尋。
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "資料格式錯誤。" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (!["draft", "approve", "disable", "enable"].includes(action)) return NextResponse.json({ error: "動作不正確。" }, { status: 400 });

  const question = await prisma.assistantQuestion.findUnique({ where: { id: params.id }, include: { knowledge: true } });
  if (!question) return NextResponse.json({ error: "找不到這筆投稿。" }, { status: 404 });
  const existing = question.knowledge;

  // 停用／重新啟用：不改內容
  if (action === "disable" || action === "enable") {
    if (!existing) return NextResponse.json({ error: "這筆投稿還沒有建立知識。" }, { status: 400 });
    if (action === "enable" && existing.status !== "approved") return NextResponse.json({ error: "草稿需要先「核准並啟用」。" }, { status: 400 });
    const k = await prisma.assistantKnowledge.update({ where: { id: existing.id }, data: { isActive: action === "enable" } });
    return NextResponse.json({ knowledge: k });
  }

  const standardQuestion = cleanText(body.standardQuestion, LIMITS.standard);
  const answerZh = cleanText(body.answerZh, LIMITS.answer);
  const answerEn = cleanText(body.answerEn, LIMITS.answer);
  const url = cleanSourceUrl(body.sourceUrl);
  if (!url.ok) return NextResponse.json({ error: "來源連結只能是站內路徑（例如 /life/bus）或 https 開頭的網址。" }, { status: 400 });
  if (action === "approve" && (!standardQuestion || !answerZh)) {
    return NextResponse.json({ error: "核准前，「標準問題」與「正式答案（中文）」都要填寫。" }, { status: 400 });
  }
  if (action === "draft" && !standardQuestion) return NextResponse.json({ error: "請至少填寫標準問題。" }, { status: 400 });
  const category = typeof body.category === "string" && (QUESTION_CATEGORIES as readonly string[]).includes(body.category) ? body.category : "other";

  const data = {
    standardQuestion,
    questionEn: cleanText(body.questionEn, LIMITS.standard),
    answerZh,
    answerEn,
    synonyms: cleanText(body.synonyms, LIMITS.synonyms),
    category,
    sourceUrl: url.value,
    status: action === "approve" ? "approved" : "draft",
    isActive: action === "approve",
  };

  try {
    const [knowledge] = await prisma.$transaction([
      existing
        ? prisma.assistantKnowledge.update({ where: { id: existing.id }, data })
        : prisma.assistantKnowledge.create({ data: { ...data, questionId: question.id } }),
      prisma.assistantQuestion.update({
        where: { id: question.id },
        data: {
          standardQuestion,
          // 核准 → 已建立知識；草稿 → 整理中（不降級已建立知識的狀態）
          status: action === "approve" ? "knowledge_created" : question.status === "pending" ? "organizing" : question.status,
        },
      }),
    ]);
    return NextResponse.json({ knowledge });
  } catch (err) {
    console.error("[admin-assistant-knowledge] save failed:", err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
