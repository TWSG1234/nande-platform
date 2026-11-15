import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const MODELS: Record<string, string> = { "life-category": "lifeCategory", "campus-category": "campusCategory", "life-item": "lifeItem", "campus-spot": "campusSpot" };

/** 調整順序：body { scope, ids:[依新順序排好的 id] }。只改 order 欄位（0、10、20…），而且只動有列出的 id；用 id 關聯，所以不會錯位。 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const model = MODELS[String(body.scope)];
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 500) : [];
  if (!model || ids.length === 0) return NextResponse.json({ error: "資料不正確。" }, { status: 400 });
  try {
    const db = (prisma as any)[model];
    for (let i = 0; i < ids.length; i++) await db.update({ where: { id: ids[i] }, data: { order: i * 10 } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "調整順序失敗，請稍後再試一次（若是校園分類，請確認已執行 npm run db:push）。" }, { status: 500 });
  }
}
