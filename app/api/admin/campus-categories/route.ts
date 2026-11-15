import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";
import { CATEGORY_ID_RE, DEFAULT_CAMPUS_CATEGORIES } from "@/lib/campusCategories";

export const dynamic = "force-dynamic";
const db = () => (prisma as any).campusCategory;
const missing = (e: unknown) => (e as any)?.code === "P2021" || /does not exist|no such table|not a function|undefined/i.test(String((e as any)?.message ?? ""));
const MISSING_MSG = "「校園分類」資料表尚未建立。請先關閉網站，執行 npm run db:push（會自動備份、只新增資料表），再重新啟動。";

/** 資料表是空的時，補上兩個預設分類（只補缺、不覆蓋；管理員之後刪掉就不會再補）。 */
async function ensureDefaultCampusCategories() {
  if ((await db().count()) > 0) return;
  for (const c of DEFAULT_CAMPUS_CATEGORIES) {
    await db().upsert({ where: { id: c.id }, update: {}, create: { id: c.id, nameZh: c.nameZh, nameEn: c.nameEn, descriptionZh: "", descriptionEn: "", order: c.order, isPublished: true } });
  }
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  try {
    await ensureDefaultCampusCategories();
    const categories = await db().findMany({ orderBy: [{ order: "asc" }] });
    return NextResponse.json({ categories });
  } catch (e) {
    if (missing(e)) return NextResponse.json({ categories: DEFAULT_CAMPUS_CATEGORIES, tableMissing: true, error: MISSING_MSG });
    return NextResponse.json({ error: "讀取失敗。" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id || !body.nameZh?.trim()) return NextResponse.json({ error: "請填寫分類代碼與名稱。" }, { status: 400 });
  if (!CATEGORY_ID_RE.test(id)) return NextResponse.json({ error: "分類代碼只能用英文字母、數字、- 與 _。" }, { status: 400 });
  try {
    await ensureDefaultCampusCategories();
    if (await db().findUnique({ where: { id }, select: { id: true } })) return NextResponse.json({ error: "這個分類代碼已經被使用過了，請換一個。" }, { status: 400 });
    const { values, enSourceJson } = await resolveBilingualFields({
      name: { zh: body.nameZh, en: body.nameEn, source: body.nameEnSource },
      description: { zh: body.descriptionZh, en: body.descriptionEn, source: body.descriptionEnSource },
    });
    const last = await db().findMany({ orderBy: [{ order: "desc" }], take: 1 });
    const created = await db().create({
      data: { id, nameZh: body.nameZh, nameEn: values.nameEn, descriptionZh: body.descriptionZh || "", descriptionEn: values.descriptionEn, enSource: enSourceJson, order: (last[0]?.order ?? 0) + 10, isPublished: body.isPublished !== false },
    });
    return NextResponse.json({ category: created });
  } catch (e) {
    return missing(e) ? NextResponse.json({ error: MISSING_MSG }, { status: 503 }) : NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
