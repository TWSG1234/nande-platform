import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 管理員：公告文字連結可選的「站內指定內容」清單（用資料 ID，不是顯示名稱）。讀不到的部分回傳空陣列。 */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const safe = async <T,>(fn: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await fn();
    } catch {
      return [];
    }
  };
  const db = prisma as any;
  const [life, campus, lifeStages, campusStages] = await Promise.all([
    safe(async () => (await db.lifeItem.findMany({ select: { id: true, titleZh: true, category: { select: { nameZh: true } } }, orderBy: [{ order: "asc" }] })).map((r: any) => ({ id: r.id, name: `${r.category?.nameZh ?? ""}／${r.titleZh}` }))),
    safe(async () => (await db.campusSpot.findMany({ select: { id: true, nameZh: true }, orderBy: [{ order: "asc" }] })).map((r: any) => ({ id: r.id, name: r.nameZh }))),
    safe(async () => (await db.chineseStage.findMany({ where: { track: "life" }, orderBy: [{ order: "asc" }] })).map((r: any) => ({ id: r.id, name: `第 ${r.levelNumber} 關${r.titleZh ? "：" + r.titleZh : ""}` }))),
    safe(async () => (await db.chineseStage.findMany({ where: { track: "campus" }, orderBy: [{ order: "asc" }] })).map((r: any) => ({ id: r.id, name: `第 ${r.levelNumber} 關${r.titleZh ? "：" + r.titleZh : ""}` }))),
  ]);
  return NextResponse.json({ life, campus, "chinese-life": lifeStages, "chinese-campus": campusStages });
}
