import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const settings = await prisma.siteSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.drillBodyZh?.trim()) {
    return NextResponse.json({ error: "請填寫「確定期間內」的演習提醒內容（中文）。" }, { status: 400 });
  }

  try {
    const updated = await prisma.siteSetting.upsert({
      where: { id: "default" },
      update: {
        drillTitleZh: body.drillTitleZh || "演習提醒",
        drillTitleEn: body.drillTitleEn || "Drill Reminder",
        drillBodyZh: body.drillBodyZh,
        drillBodyEn: body.drillBodyEn || body.drillBodyZh,
        drillGeneralBodyZh: body.drillGeneralBodyZh || "",
        drillGeneralBodyEn: body.drillGeneralBodyEn || body.drillGeneralBodyZh || "",
        drillStart: body.drillStart || "",
        drillEnd: body.drillEnd || "",
      },
      create: {
        id: "default",
        drillTitleZh: body.drillTitleZh || "演習提醒",
        drillTitleEn: body.drillTitleEn || "Drill Reminder",
        drillBodyZh: body.drillBodyZh,
        drillBodyEn: body.drillBodyEn || body.drillBodyZh,
        drillGeneralBodyZh: body.drillGeneralBodyZh || "",
        drillGeneralBodyEn: body.drillGeneralBodyEn || body.drillGeneralBodyZh || "",
        drillStart: body.drillStart || "",
        drillEnd: body.drillEnd || "",
      },
    });
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
