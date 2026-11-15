import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualField } from "@/lib/translationService";

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

  try {
    // 網站名稱是品牌名稱（專有名詞），不處理雙語，沒填就用預設值；副標題是
    // 一般敘述文字，管理員填了英文就用他填的，沒填的話英文暫時等於中文
    // （目前沒有任何自動翻譯功能）。這個頁面目前還沒有前台顯示位置，也還
    // 沒有表單 UI，先維持簡單版本。
    const subtitleEn = resolveBilingualField({
      zh: body.subtitleZh,
      submittedEn: body.subtitleEn,
      submittedSource: body.subtitleEn?.trim() ? "MANUAL" : "AUTO",
    }).value;

    const updated = await prisma.siteSetting.update({
      where: { id: "default" },
      data: {
        siteNameZh: body.siteNameZh || "南得遇見你",
        siteNameEn: body.siteNameEn || "Exchange Compass",
        subtitleZh: body.subtitleZh || "",
        subtitleEn,
        contactInfo: body.contactInfo || "",
      },
    });
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
