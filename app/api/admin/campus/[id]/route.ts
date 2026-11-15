import { snapshotImages, releaseChanged, releaseImage } from "@/lib/imageRefs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { resolveCampusCategoryId } from "@/lib/campusCategories";
import { prisma } from "@/lib/prisma";
import { parseSchoolTimesText, schoolTimesToText } from "@/lib/schoolTimes";
import { toJsonField, fromJsonField } from "@/lib/jsonFields";
import { resolveBilingualFields, type BilingualInput } from "@/lib/translationService";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const spot = await prisma.campusSpot.findUnique({ where: { id: params.id } });
  if (!spot) return NextResponse.json({ error: "找不到這筆資料。" }, { status: 404 });

  const source = fromJsonField<Record<string, string>>(spot.enSource, {});
  return NextResponse.json({
    spot: {
      ...spot,
      schoolTimesText: schoolTimesToText(spot.schoolTimes),
      nameEnSource: source.nameEn,
      descriptionEnSource: source.descriptionEn,
      detailsEnSource: source.detailsEn,
      mainResponsibilityEnSource: source.mainResponsibilityEn,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "送出的內容無法讀取。" }, { status: 400 });
  }

  // 列表頁的「顯示／隱藏」只送 isPublished（或 order）：只改這些欄位，其他內容（圖片、說明、英文）完全不動。
  // 以前列表頁把「列表上有的幾個欄位」當整筆資料送回來，儲存時圖片、詳細說明、英文都被洗掉或被中文覆蓋。
  if (body.nameZh === undefined && body.descriptionZh === undefined && (body.isPublished !== undefined || body.order !== undefined)) {
    try {
      const updated = await prisma.campusSpot.update({
        where: { id: params.id },
        data: {
          isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
          order: body.order !== undefined ? Number(body.order) || 0 : undefined,
        },
      });
      return NextResponse.json({ spot: updated });
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
    }
  }

  if (!String(body.nameZh ?? "").trim() || !String(body.descriptionZh ?? "").trim()) {
    return NextResponse.json({ error: "請填寫標題與介紹。" }, { status: 400 });
  }
  const category = body.category === undefined ? undefined : await resolveCampusCategoryId(prisma, body.category);
  if (category === null) return NextResponse.json({ error: "分類不正確，請重新選擇。" }, { status: 400 });

  try {
    const existing = await prisma.campusSpot.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "找不到這筆資料，可能已被刪除。請重新整理頁面。" }, { status: 404 });

    // 英文欄位：只處理「這次有送來」的欄位群組；沒送的欄位（以及它的英文）保持原樣。
    const has = (k: string) => body[k] !== undefined;
    const fields: { name: BilingualInput; description: BilingualInput; details?: BilingualInput; mainResponsibility?: BilingualInput } = {
      // 這次沒送英文欄位（undefined）→ 沿用資料庫裡原本的英文，不用中文覆蓋
      name: { zh: body.nameZh, en: body.nameEn ?? existing.nameEn, source: body.nameEnSource },
      description: { zh: body.descriptionZh, en: body.descriptionEn ?? existing.descriptionEn, source: body.descriptionEnSource },
    };
    if (has("detailsZh")) fields.details = { zh: body.detailsZh, en: body.detailsEn ?? existing.detailsEn, source: body.detailsEnSource };
    if (has("mainResponsibilityZh")) fields.mainResponsibility = { zh: body.mainResponsibilityZh, en: body.mainResponsibilityEn ?? existing.mainResponsibilityEn, source: body.mainResponsibilityEnSource };
    const { values, enSourceJson } = await resolveBilingualFields(fields);
    // enSource 是整個 JSON：沒送的欄位群組要保留原本的來源標記
    const prevSource = fromJsonField<Record<string, string>>(existing.enSource, {});
    const mergedSource = JSON.stringify({ ...prevSource, ...fromJsonField<Record<string, string>>(enSourceJson, {}) });

    const imgBefore = await snapshotImages("campusSpot", params.id, ["image"]);
    const updated = await prisma.campusSpot.update({
      where: { id: params.id },
      data: {
        category,
        image: has("image") ? body.image || null : undefined,
        nameZh: body.nameZh,
        nameEn: values.nameEn,
        descriptionZh: body.descriptionZh,
        descriptionEn: values.descriptionEn,
        detailsZh: has("detailsZh") ? body.detailsZh || null : undefined,
        detailsEn: has("detailsZh") ? values.detailsEn || null : undefined,
        schoolTimes: has("schoolTimesText")
          ? parseSchoolTimesText(body.schoolTimesText).length
            ? JSON.stringify(parseSchoolTimesText(body.schoolTimesText))
            : null
          : undefined,
        mainResponsibilityZh: has("mainResponsibilityZh") ? body.mainResponsibilityZh || null : undefined,
        mainResponsibilityEn: has("mainResponsibilityZh") ? values.mainResponsibilityEn || null : undefined,
        enSource: mergedSource,
        // 表單沒有這個欄位：沒送就保留原本的內容（以前每次儲存都會被洗成空的）
        exchangeStudentMayEncounter: has("exchangeStudentMayEncounter") ? toJsonField(body.exchangeStudentMayEncounter) : undefined,
        order: has("order") ? Number(body.order) || 0 : undefined,
        isPublished: has("isPublished") ? Boolean(body.isPublished) : undefined,
      },
    });
    await releaseChanged(imgBefore, updated);
    return NextResponse.json({ spot: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}


/** 順手清掉這個資訊框的裝飾圖片，圖片檔只有全站沒人用才移到 _trash。資料表不存在也沒關係。 */
async function removeDecor(scope: string, boxId: string) {
  try {
    const rows = await (prisma as any).infoBoxImage.findMany({ where: { scope, boxId }, select: { imageUrl: true } });
    await (prisma as any).infoBoxImage.deleteMany({ where: { scope, boxId } });
    for (const r of rows) await releaseImage(r.imageUrl);
  } catch {
    /* ignore */
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    const imgBefore = await snapshotImages("campusSpot", params.id, ["image"]);
    await prisma.campusSpot.delete({ where: { id: params.id } });
    await removeDecor("campus", params.id);
    await releaseChanged(imgBefore, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
