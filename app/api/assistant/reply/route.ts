import { NextRequest, NextResponse } from "next/server";
import { getAssistantSettings } from "@/lib/ai/assistantData";
import { loadCorpus } from "@/lib/ai/search/corpus";
import { search } from "@/lib/ai/search/engine";
import { composeAnswer } from "@/lib/ai/search/respond";
import type { AssistantLang } from "@/lib/ai/types";
import { computeSignals } from "@/lib/ai/questionTypes";
import { resolveTypeForAnswer } from "@/lib/ai/questionTypesData";

/**
 * 公開 API：一般訪客問威洛問題。**只讀**——只會查詢已發布的網站資料，不會新增、修改或刪除任何東西。
 * 小助理被後台停用時直接回 403。
 * 目前不使用任何外部 AI；由 lib/ai/search 的搜尋演算法找出相關資料並排序（見 engine.ts 的說明）。
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { settings } = await getAssistantSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "assistant_disabled" }, { status: 403 });
  }

  let body: { message?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) : "";
  if (!message) return NextResponse.json({ error: "empty_message" }, { status: 400 });
  const lang: AssistantLang = body.lang === "en" ? "en" : "zh-TW";

  const docs = await loadCorpus();
  const outcome = search(message, docs);
  const answer = composeAnswer(message, lang, outcome);
  // 問題類型：沿用上面的搜尋流程結果（主題、最相關資料的來源、是否找不到答案），再依後台設定找對應類型；找不到就是 null（前端回退內建狀態）
  const fallback = answer.kind === "fallback";
  const top = outcome.results[0]?.doc;
  const type = await resolveTypeForAnswer({
    signals: computeSignals({ fallback, topic: answer.topic, sourceKind: top?.kind ?? null }),
    text: `${message} ${top?.titleZh ?? ""} ${top?.titleEn ?? ""}`,
    fallback,
  });
  return NextResponse.json({
    reply: answer.text,
    kind: answer.kind, // "fallback" = 網站目前沒有任何相關資料
    topic: answer.topic,
    type,
    mode: answer.mode,
    candidates: answer.candidates,
    suggestions: answer.suggestions,
    moreLabel: answer.moreLabel ?? null,
  });
}
