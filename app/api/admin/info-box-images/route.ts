import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { releaseImage } from "@/lib/imageRefs";
import { DECOR_SCOPES, sanitizeDecor } from "@/lib/infoBoxDecor";

export const dynamic = "force-dynamic";
const db = () => (prisma as any).infoBoxImage;
const missing = (e: unknown) => (e as any)?.code === "P2021" || /does not exist|no such table|not a function|undefined/i.test(String((e as any)?.message ?? ""));
const MSG = "「資訊框圖片」資料表尚未建立。請先關閉網站，執行 npm run db:push（會自動備份、只新增資料表），再重新啟動。";
const unauth = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
const parse = (scope: unknown, boxId: unknown) => (DECOR_SCOPES.includes(scope as any) && typeof boxId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(boxId) ? { scope: scope as string, boxId } : null);

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  const u = new URL(req.url);
  const k = parse(u.searchParams.get("scope"), u.searchParams.get("boxId"));
  if (!k) return NextResponse.json({ error: "參數不正確。" }, { status: 400 });
  try {
    const rows = await db().findMany({ where: k, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json({ images: rows.map((r: any, i: number) => ({ ...sanitizeDecor(r, i), id: r.id })).filter((d: any) => d.imageUrl) });
  } catch (e) {
    return missing(e) ? NextResponse.json({ images: [], tableMissing: true, error: MSG }) : NextResponse.json({ error: "讀取失敗。" }, { status: 500 });
  }
}

/** 整組儲存：body { scope, boxId, images:[…] }。有 id 的更新、沒 id 的新增、沒送來的刪除（圖片檔只有全站沒人用才移到 _trash）。只動這個資訊框自己的圖片。 */
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  const body = await req.json().catch(() => ({}));
  const k = parse(body.scope, body.boxId);
  if (!k || !Array.isArray(body.images)) return NextResponse.json({ error: "參數不正確。" }, { status: 400 });
  const next = body.images.slice(0, 20).map((x: unknown, i: number) => sanitizeDecor(x, i)).filter(Boolean) as NonNullable<ReturnType<typeof sanitizeDecor>>[];
  try {
    const existing = await db().findMany({ where: k });
    const keep = new Set(next.map((d) => d.id).filter(Boolean));
    const removed = existing.filter((r: any) => !keep.has(r.id));
    const changedOld: string[] = [];
    for (const d of next) {
      const data = { imageUrl: d.imageUrl, x: d.x, y: d.y, size: d.size, rotate: d.rotate, opacity: d.opacity, mobileScale: d.mobileScale, mobileVisible: d.mobileVisible, visible: d.visible, order: d.order };
      const cur = d.id ? existing.find((r: any) => r.id === d.id) : null;
      if (cur) {
        if (cur.imageUrl !== d.imageUrl) changedOld.push(cur.imageUrl);
        await db().update({ where: { id: cur.id }, data });
      } else await db().create({ data: { ...k, ...data } });
    }
    for (const r of removed) await db().delete({ where: { id: r.id } });
    for (const url of [...removed.map((r: any) => r.imageUrl), ...changedOld]) await releaseImage(url);
    const rows = await db().findMany({ where: k, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json({ images: rows.map((r: any, i: number) => ({ ...sanitizeDecor(r, i), id: r.id })) });
  } catch (e) {
    return missing(e) ? NextResponse.json({ error: MSG }, { status: 503 }) : NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
