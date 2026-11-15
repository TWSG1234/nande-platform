import { NextRequest, NextResponse } from "next/server";
import { getAssistantSettings } from "@/lib/ai/assistantData";
import { loadCorpus } from "@/lib/ai/search/corpus";
import { detailFor } from "@/lib/ai/search/respond";
import type { AssistantLang } from "@/lib/ai/types";
import { classifyLifeTopic } from "@/lib/ai/topic";
import { computeSignals } from "@/lib/ai/questionTypes";
import { resolveTypeForAnswer } from "@/lib/ai/questionTypesData";

/** 公開 API（只讀）：使用者在候選清單選了某一項，回傳該筆「已發布資料」的詳細內容。 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { settings } = await getAssistantSettings();
  if (!settings.enabled) return NextResponse.json({ error: "assistant_disabled" }, { status: 403 });
  let body: { id?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.slice(0, 200) : "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const lang: AssistantLang = body.lang === "en" ? "en" : "zh-TW";
  // 只從「已發布、已核准」的搜尋資料中找；找不到（含已停用、未發布、不存在）一律 404
  const doc = (await loadCorpus()).find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const type = await resolveTypeForAnswer({
    signals: computeSignals({ fallback: false, topic: classifyLifeTopic(`${doc.titleZh} ${doc.categoryZh}`), sourceKind: doc.kind }),
    text: `${doc.titleZh} ${doc.titleEn}`,
    fallback: false,
  });
  return NextResponse.json({ ...detailFor(doc, lang), type });
}
