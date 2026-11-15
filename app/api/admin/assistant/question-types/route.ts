import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { releaseChanged, snapshotImages } from "@/lib/imageRefs";
import { fromRow, makeKey, sanitizeTypeInput, joinSignals, SYSTEM_STATES } from "@/lib/ai/questionTypes";

/**
 * 管理員：威洛「問題類型與角色狀態」。需要登入。
 * 內建系統狀態（idle／thinking／life_info／unresolved）不在這張表，不能被刪除，也是找不到對應類型時的安全回退。
 */
export const dynamic = "force-dynamic";
const db = () => (prisma as any).assistantQuestionType;
const unauth = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
const tableMissing = (e: unknown) => /does not exist|no such table|P2021|not a function|undefined/i.test(String((e as any)?.message ?? "")) || (e as any)?.code === "P2021";
const dbErr = (e: unknown) =>
  tableMissing(e)
    ? NextResponse.json({ error: "「問題類型」資料表尚未建立。請先關閉網站，執行 npm run db:push（會自動備份、只新增資料表），再重新啟動。", tableMissing: true }, { status: 503 })
    : NextResponse.json({ error: "資料庫操作失敗，請稍後再試。" }, { status: 500 });

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  try {
    const rows = await db().findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json({ types: rows.map(fromRow), systemStates: SYSTEM_STATES });
  } catch (e) {
    if (tableMissing(e)) return NextResponse.json({ types: [], systemStates: SYSTEM_STATES, tableMissing: true });
    return dbErr(e);
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  const body = await req.json().catch(() => null);
  const v = sanitizeTypeInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const existing = new Set<string>((await db().findMany({ select: { key: true } })).map((r: any) => r.key));
    const key = makeKey(v.data.nameEn || "", existing);
    const row = await db().create({ data: { key, ...v.data, signals: joinSignals(v.data.signals), keywords: v.data.keywords.join("\n") } });
    return NextResponse.json({ type: fromRow(row) });
  } catch (e) {
    return dbErr(e);
  }
}

/** 修改單一類型（body.id＋欄位）；或調整順序（body.order＝id 陣列，依序重新編號優先順序）。 */
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  const body = await req.json().catch(() => null);
  try {
    if (Array.isArray(body?.order)) {
      const ids = (body.order as unknown[]).filter((x): x is string => typeof x === "string");
      for (let i = 0; i < ids.length; i++) await db().update({ where: { id: ids[i] }, data: { priority: (i + 1) * 10 } });
      const rows = await db().findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
      return NextResponse.json({ types: rows.map(fromRow) });
    }
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "缺少類型 ID。" }, { status: 400 });
    const v = sanitizeTypeInput(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const before = await snapshotImages("assistantQuestionType", id, ["imageUrl"]);
    const row = await db().update({ where: { id }, data: { ...v.data, signals: joinSignals(v.data.signals), keywords: v.data.keywords.join("\n") } });
    await releaseChanged(before, { imageUrl: row.imageUrl }); // 舊圖只有在全站沒有其他地方使用時才移到 uploads/_trash
    return NextResponse.json({ type: fromRow(row) });
  } catch (e) {
    return dbErr(e);
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "缺少類型 ID。" }, { status: 400 });
  try {
    const before = await snapshotImages("assistantQuestionType", id, ["imageUrl"]);
    await db().delete({ where: { id } });
    // 刪除後威洛不會壞：找不到對應類型時，前台自動回退到系統狀態（生活資訊／暫時無法解決／待機）
    await releaseChanged(before, { imageUrl: "" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as any)?.code === "P2025") return NextResponse.json({ ok: true });
    return dbErr(e);
  }
}
