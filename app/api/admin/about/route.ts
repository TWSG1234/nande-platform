import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";
import { fromJsonField } from "@/lib/jsonFields";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const about = await prisma.aboutContent.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const source = fromJsonField<Record<string, string>>(about.enSource, {});
  return NextResponse.json({
    about: { ...about, titleEnSource: source.titleEn, contentEnSource: source.contentEn },
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  // 「理念」與「聯絡我們」是兩個獨立的表單，各自只送自己的欄位：
  // 只有送了理念欄位（titleZh／contentZh…）才會處理理念與它的英文，聯絡表單儲存時不會碰到理念內容。
  const touchesMission = ["titleZh", "titleEn", "contentZh", "contentEn"].some((k) => body[k] !== undefined);
  if (touchesMission && (!body.titleZh?.trim() || !body.contentZh?.trim())) {
    return NextResponse.json({ error: "請填寫中文標題與中文內容。" }, { status: 400 });
  }

  try {
    const contact = {
      contactTitleZh: body.contactTitleZh ?? undefined,
      contactTitleEn: body.contactTitleEn ?? undefined,
      contactBodyZh: body.contactBodyZh ?? undefined,
      contactBodyEn: body.contactBodyEn ?? undefined,
      email: body.email ?? undefined,
      phone: body.phone ?? undefined,
      address: body.address ?? undefined,
      socialLinksJson: body.socialLinks !== undefined ? JSON.stringify(body.socialLinks) : undefined,
    };
    let mission: Record<string, string | undefined> = {};
    if (touchesMission) {
      const { values, enSourceJson } = await resolveBilingualFields({
        title: { zh: body.titleZh, en: body.titleEn, source: body.titleEnSource },
        content: { zh: body.contentZh, en: body.contentEn, source: body.contentEnSource },
      });
      mission = { titleZh: body.titleZh, titleEn: values.titleEn, contentZh: body.contentZh, contentEn: values.contentEn, enSource: enSourceJson };
    }

    const updated = await prisma.aboutContent.upsert({
      where: { id: "default" },
      update: { ...mission, ...contact },
      create: {
        id: "default",
        ...mission,
        contactTitleZh: body.contactTitleZh || "",
        contactTitleEn: body.contactTitleEn || "",
        contactBodyZh: body.contactBodyZh || "",
        contactBodyEn: body.contactBodyEn || "",
        email: body.email || "",
        phone: body.phone || "",
        address: body.address || "",
        socialLinksJson: body.socialLinks ? JSON.stringify(body.socialLinks) : "[]",
      },
    });
    return NextResponse.json({ about: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
