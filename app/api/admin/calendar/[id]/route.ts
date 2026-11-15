import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { toJsonField, fromJsonField } from "@/lib/jsonFields";
import { resolveBilingualFields } from "@/lib/translationService";
import { deleteLocalImage } from "@/lib/uploadImage";
import { CALENDAR_BASE_SELECT, IMAGE_COLUMN_MISSING_MESSAGE, isMissingImageColumn, normalizeImageUrl } from "@/lib/calendarDb";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  let event;
  try {
    event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  } catch (err) {
    if (!isMissingImageColumn(err)) throw err;
    event = await prisma.calendarEvent.findUnique({ where: { id: params.id }, select: CALENDAR_BASE_SELECT });
  }
  if (!event) return NextResponse.json({ error: "找不到這筆節日資料。" }, { status: 404 });

  const source = fromJsonField<Record<string, string>>(event.enSource, {});
  return NextResponse.json({
    event: {
      ...event,
      nameEnSource: source.nameEn,
      descriptionEnSource: source.descriptionEn,
      originEnSource: source.originEn,
      noteEnSource: source.noteEn,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.date?.trim() || !body.nameZh?.trim()) {
    return NextResponse.json({ error: "請填寫日期與節日名稱。" }, { status: 400 });
  }
  if (body.isOfficial && !body.sourceZh?.trim()) {
    return NextResponse.json(
      { error: "標示為「官方」的節日資料，必須填寫官方資料來源。" },
      { status: 400 }
    );
  }

  const img = normalizeImageUrl(body.imageUrl);
  if (!img.ok) return NextResponse.json({ error: "節日小圖網址不正確，請重新上傳圖片。" }, { status: 400 });

  try {
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
        // 表單沒有這個欄位：沒送就保留原本的內容（以前會被洗成空的）
        taiwanCustoms: body.taiwanCustoms !== undefined ? toJsonField(body.taiwanCustoms) : undefined,
        sourceZh: body.sourceZh || null,
        sourceEn: body.sourceEn || body.sourceZh || null,
        noteZh: body.noteZh || null,
        noteEn: values.noteEn || null,
        enSource: enSourceJson,
        isOfficial: Boolean(body.isOfficial),
        isPublished: Boolean(body.isPublished),
    };

    // 舊圖片網址（欄位尚未建立時讀不到，視為沒有）
    let oldImage: string | null = null;
    try {
      const cur = await prisma.calendarEvent.findUnique({ where: { id: params.id }, select: { imageUrl: true } });
      oldImage = cur?.imageUrl ?? null;
    } catch (err) {
      if (!isMissingImageColumn(err)) throw err;
    }

    // 只回傳 id，避免 Prisma 回讀 imageUrl。
    // 規則：沒有舊圖也沒有新圖時完全不碰 imageUrl（欄位尚未建立時照常儲存其他內容）。
    const touchImage = Boolean(oldImage) || Boolean(img.value);
    const updated = { id: params.id };
    try {
      await prisma.calendarEvent.update({
        where: { id: params.id },
        data: touchImage ? { ...baseData, imageUrl: img.value } : baseData,
        select: { id: true },
      });
    } catch (err) {
      if (isMissingImageColumn(err) && img.value) return NextResponse.json({ error: IMAGE_COLUMN_MISSING_MESSAGE }, { status: 409 });
      throw err;
    }

    // 圖片被更換或移除：舊檔只是移到 uploads/_trash（可找回），不是永久刪除
    if (oldImage && oldImage !== img.value) {
      try {
        await deleteLocalImage(oldImage);
      } catch (err) {
        console.error("[calendar] 舊節日小圖移到回收資料夾失敗（不影響儲存）：", err);
      }
    }
    return NextResponse.json({ event: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    await prisma.calendarEvent.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
