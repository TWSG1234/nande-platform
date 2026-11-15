import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";
import { sanitizeLinkSet, parseLinkSetRow } from "@/lib/announcementLinks";
const linkTableMissing = (e: unknown) => /does not exist|no such table|P2021|not a function|undefined/i.test(String((e as any)?.message ?? "")) || (e as any)?.code === "P2021";
/** 儲存連結設定（獨立資料表）。回傳要顯示給管理員的警告（資料表未建立等）；不影響公告本身的儲存。 */
async function saveLinkSet(announcementId: string, raw: unknown): Promise<string | null> {
  if (raw === undefined) return null; // 這次沒有送連結設定＝不動
  const { data, errors } = sanitizeLinkSet(raw);
  try {
    await (prisma as any).announcementLinkSet.upsert({
      where: { announcementId },
      update: { show: data.show, linksJson: JSON.stringify(data.links) },
      create: { announcementId, show: data.show, linksJson: JSON.stringify(data.links) },
    });
    return errors.length ? errors.join(" ") : null;
  } catch (e) {
    return linkTableMissing(e) ? "公告已儲存，但「文字連結」資料表尚未建立，連結沒有儲存。請先關閉網站、執行 npm run db:push，再重新設定連結。" : "公告已儲存，但文字連結儲存失敗，請稍後再試。";
  }
}


export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const rows = await prisma.announcement.findMany({ orderBy: [{ type: "asc" }, { order: "asc" }, { publishDate: "desc" }] });
  const announcements = rows.map((a: (typeof rows)[number]) => ({
    ...a,
    startDate: a.startDate ? a.startDate.toISOString().slice(0, 10) : "",
    endDate: a.endDate ? a.endDate.toISOString().slice(0, 10) : "",
    relatedHoliday: a.relatedHoliday || "",
  }));
  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.titleZh?.trim() || !body.contentZh?.trim()) {
    return NextResponse.json({ error: "請填寫公告標題與內容。" }, { status: 400 });
  }
  const type = body.type === "holiday" ? "holiday" : "permanent";
  if (type === "holiday" && (!body.startDate || !body.endDate)) {
    return NextResponse.json({ error: "節假日公告請填寫開始與結束日期。" }, { status: 400 });
  }

  try {
    const { values, enSourceJson } = await resolveBilingualFields({
      title: { zh: body.titleZh, en: body.titleEn, source: body.titleEnSource },
      content: { zh: body.contentZh, en: body.contentEn, source: body.contentEnSource },
    });
    const created = await prisma.announcement.create({
      data: {
        type,
        titleZh: body.titleZh,
        titleEn: values.titleEn,
        contentZh: body.contentZh,
        contentEn: values.contentEn,
        enSource: enSourceJson,
        image: body.image || null,
        startDate: type === "holiday" && body.startDate ? new Date(body.startDate) : null,
        endDate: type === "holiday" && body.endDate ? new Date(body.endDate) : null,
        relatedHoliday: type === "holiday" ? body.relatedHoliday || null : null,
        order: Number(body.order) || 0,
        publishDate: body.publishDate ? new Date(body.publishDate) : new Date(),
        isPublished: Boolean(body.isPublished),
      },
    });
    const linkWarning = await saveLinkSet(created.id, body.linkSet);
    return NextResponse.json({ announcement: created, linkWarning });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
