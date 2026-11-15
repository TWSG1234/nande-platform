import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { toJsonField } from "@/lib/jsonFields";
import { resolveBilingualFields } from "@/lib/translationService";
import { CALENDAR_BASE_SELECT, IMAGE_COLUMN_MISSING_MESSAGE, isMissingImageColumn, normalizeImageUrl } from "@/lib/calendarDb";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    const events = await prisma.calendarEvent.findMany({ orderBy: { date: "asc" } });
    return NextResponse.json({ events });
  } catch (err) {
    if (!isMissingImageColumn(err)) throw err;
    // 還沒執行 db:push：不含節日小圖欄位，後台列表照常使用
    const events = await prisma.calendarEvent.findMany({ orderBy: { date: "asc" }, select: CALENDAR_BASE_SELECT });
    return NextResponse.json({ events, imageColumnMissing: true });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.date?.trim() || !body.nameZh?.trim()) {
    return NextResponse.json({ error: "請填寫日期與節日名稱。" }, { status: 400 });
  }
  // 規格要求：不能讓管理員任意輸入沒有來源的官方節日資訊。
  if (body.isOfficial && !body.sourceZh?.trim()) {
    return NextResponse.json(
      { error: "標示為「官方」的節日資料，必須填寫官方資料來源（例如：行政院人事行政總處）。" },
      { status: 400 }
    );
  }

  const img = normalizeImageUrl(body.imageUrl);
  if (!img.ok) return NextResponse.json({ error: "節日小圖網址不正確，請重新上傳圖片。" }, { status: 400 });

  try {
    // 節日名稱／簡短介紹／由來/故事／備註都是一般敘述文字，沒填英文就自動翻譯。
    // 官方資料來源（source）跟標籤（tag）故意不自動翻譯——那通常是機關名稱或
    // 固定引用字串，自動翻譯反而可能翻錯，維持原本「沒填就跟中文一樣」的做法。
    const { values, enSourceJson } = await resolveBilingualFields({
      name: { zh: body.nameZh, en: body.nameEn, source: body.nameEnSource },
      description: { zh: body.descriptionZh, en: body.descriptionEn, source: body.descriptionEnSource },
      origin: { zh: body.originZh, en: body.originEn, source: body.originEnSource },
      note: { zh: body.noteZh, en: body.noteEn, source: body.noteEnSource },
    });

    const baseData = {
        date: body.date,
        nameZh: body.nameZh,
        nameEn: values.nameEn,
        isHoliday: Boolean(body.isHoliday),
        isMakeup: Boolean(body.isMakeup),
        descriptionZh: body.descriptionZh || "",
        descriptionEn: values.descriptionEn,
        originZh: body.originZh || null,
        originEn: values.originEn || null,
        taiwanCustoms: toJsonField(body.taiwanCustoms),
        sourceZh: body.sourceZh || null,
        sourceEn: body.sourceEn || body.sourceZh || null,
        noteZh: body.noteZh || null,
        noteEn: values.noteEn || null,
        enSource: enSourceJson,
        isOfficial: Boolean(body.isOfficial),
        isPublished: Boolean(body.isPublished),
    };
    // 只回傳 id，避免 Prisma 回讀 imageUrl（欄位尚未建立時才不會出錯）
    let created;
    try {
      created = await prisma.calendarEvent.create({ data: img.value ? { ...baseData, imageUrl: img.value } : baseData, select: { id: true } });
    } catch (err) {
      if (isMissingImageColumn(err) && img.value) return NextResponse.json({ error: IMAGE_COLUMN_MISSING_MESSAGE }, { status: 409 });
      throw err;
    }
    return NextResponse.json({ event: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
