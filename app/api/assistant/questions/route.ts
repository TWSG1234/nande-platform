import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAssistantSettings } from "@/lib/ai/assistantData";
import { createRateLimiter, validateSubmission } from "@/lib/ai/questions";

/**
 * 公開 API：使用者提交「威洛沒有充分回答的問題」。
 * - 只有 POST。沒有 GET／列表／讀取（使用者不能讀任何人的投稿，包含自己的）。
 * - 只寫入 AssistantQuestion（未審核的原始投稿）；絕不會寫進知識庫，也不會被搜尋到。
 * - clientKey 唯一：重複點擊或網路重試只會建立一筆。
 * - 回傳 ok:true 一定是「已成功寫入資料庫」之後。
 */
export const dynamic = "force-dynamic";

const allow = createRateLimiter(8, 10 * 60 * 1000); // 同一來源 10 分鐘最多 8 筆

export async function POST(req: NextRequest) {
  const { settings } = await getAssistantSettings();
  if (!settings.enabled) return NextResponse.json({ error: "assistant_disabled" }, { status: 403 });

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 20000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const v = validateSubmission(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(ip)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const q = v.value;
  try {
    await prisma.assistantQuestion.create({
      data: {
        clientKey: q.clientKey,
        question: q.question,
        category: q.category,
        note: q.note,
        lang: q.lang,
        contextQuestion: q.contextQuestion,
        contextCandidates: q.contextCandidates.length ? JSON.stringify(q.contextCandidates) : "",
      },
      select: { id: true }, // 不把任何資料回傳給使用者
    });
  } catch (err) {
    // 同一個 clientKey 已經存在＝先前那次已成功（重複點擊／重試）：視為成功，不重複建立
    if ((err as { code?: string }).code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[assistant-questions] save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
