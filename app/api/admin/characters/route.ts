import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const characters = await prisma.ipCharacter.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ characters });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim() || !body.image?.trim()) {
    return NextResponse.json({ error: "請填寫角色名稱並上傳角色圖片。" }, { status: 400 });
  }

  try {
    if (body.homePosition) {
      await prisma.ipCharacter.updateMany({ where: { homePosition: body.homePosition }, data: { homePosition: null } });
    }

    // 角色「名稱」本身是專有名詞（吉祥物的名字），不自動翻譯。身分證上的
    // 定位／個性／一句話／背景故事都是一般文字，沒填英文就沿用既有的雙語
    // 規則（管理員自己填，留空暫時用中文頂著）。
    const { values, enSourceJson } = await resolveBilingualFields({
      intro: { zh: body.introZh, en: body.introEn, source: body.introEnSource },
      position: { zh: body.positionZh, en: body.positionEn, source: body.positionEnSource },
      personality: { zh: body.personalityZh, en: body.personalityEn, source: body.personalityEnSource },
      quote: { zh: body.quoteZh, en: body.quoteEn, source: body.quoteEnSource },
      conceptTitle: { zh: body.conceptTitleZh, en: body.conceptTitleEn, source: body.conceptTitleEnSource },
    });

    const created = await prisma.ipCharacter.create({
      data: {
        name: body.name,
        image: body.image,
        introZh: body.introZh || "",
        introEn: values.introEn,
        positionZh: body.positionZh || "",
        positionEn: values.positionEn,
        personalityZh: body.personalityZh || "",
        personalityEn: values.personalityEn,
        quoteZh: body.quoteZh || "",
        quoteEn: values.quoteEn,
        conceptTitleZh: body.conceptTitleZh || "",
        conceptTitleEn: values.conceptTitleEn,
        dialogueZh: body.dialogueZh || "",
        dialogueEn: body.dialogueEn || "",
        dialogueEnabled: body.dialogueEnabled ?? true,
        homePosition: body.homePosition || null,
        backImage: body.backImage || null,
        backImageWidth: body.backImageWidth ? Number(body.backImageWidth) : null,
        backImageHeight: body.backImageHeight ? Number(body.backImageHeight) : null,
        bgColor: body.bgColor || "#FFFFFF",
        borderColor: body.borderColor || "#84bed7",
        textColor: body.textColor || "#1B1B1B",
        accentColor: body.accentColor || "#2a6ea2",
        enSource: enSourceJson,
        order: Number(body.order) || 0,
        isVisible: Boolean(body.isVisible),
      },
    });
    return NextResponse.json({ character: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
