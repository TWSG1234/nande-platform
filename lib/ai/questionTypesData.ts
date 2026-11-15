import { prisma } from "@/lib/prisma";
import { fromRow, matchQuestionType, toPublic, type PublicQuestionType, type QuestionTypeData } from "./questionTypes";

/** 讀取全部類型。資料表尚未建立／讀取失敗 → 空陣列（威洛照常使用內建狀態，不會壞）。 */
export async function getQuestionTypes(): Promise<QuestionTypeData[]> {
  try {
    const rows = await (prisma as any).assistantQuestionType.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
    return rows.map(fromRow);
  } catch (err) {
    const msg = String((err as any)?.message ?? "");
    if (!/does not exist|no such table|P2021|not a function|undefined/i.test(msg)) console.error("[assistant] question types read failed:", err);
    return [];
  }
}

export async function resolveTypeForAnswer(ctx: { signals: string[]; text: string; fallback: boolean }): Promise<PublicQuestionType | null> {
  const t = matchQuestionType(await getQuestionTypes(), ctx);
  return t ? toPublic(t) : null;
}
