import { snapshotImages, releaseChanged } from "@/lib/imageRefs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { resolveBilingualFields } from "@/lib/translationService";
import { fromJsonField } from "@/lib/jsonFields";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const character = await prisma.ipCharacter.findUnique({
    where: { id: params.id },
    include: { dialogueLines: { orderBy: { order: "asc" } } },
  });
  if (!character) return NextResponse.json({ error: "找不到這個角色。" }, { status: 404 });

  const source = fromJsonField<Record<string, string>>(character.enSource, {});
  return NextResponse.json({
    character: {
      ...character,
      introEnSource: source.introEn,
      positionEnSource: source.positionEn,
      personalityEnSource: source.personalityEn,
      quoteEnSource: source.quoteEn,
      conceptTitleEnSource: source.conceptTitleEn,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "請填寫角色名稱。" }, { status: 400 });
  }

  try {
    // 同一個首頁位置同一時間只能有一隻角色對應——如果這次要把某個位置指定
    // 給這隻角色，先把「目前佔用那個位置的其他角色」清空，避免兩隻角色
    // 同時宣稱自己是「首頁角色1」。
    if (body.homePosition) {
      await prisma.ipCharacter.updateMany({
        where: { homePosition: body.homePosition, id: { not: params.id } },
        data: { homePosition: null },
      });
    }

    const { values, enSourceJson } = await resolveBilingualFields({
      intro: { zh: body.introZh, en: body.introEn, source: body.introEnSource },
      position: { zh: body.positionZh, en: body.positionEn, source: body.positionEnSource },
      personality: { zh: body.personalityZh, en: body.personalityEn, source: body.personalityEnSource },
      quote: { zh: body.quoteZh, en: body.quoteEn, source: body.quoteEnSource },
      conceptTitle: { zh: body.conceptTitleZh, en: body.conceptTitleEn, source: body.conceptTitleEnSource },
    });

    const imgBefore = await snapshotImages("ipCharacter", params.id, ["image", "backImage"]);
    const updated = await prisma.ipCharacter.update({
      where: { id: params.id },
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
        // 舊的單句對話欄位：表單沒有它（改用「首頁對話回覆」管理）；沒送就保留，不再被洗成空字串
        dialogueZh: body.dialogueZh !== undefined ? body.dialogueZh || "" : undefined,
        dialogueEn: body.dialogueEn !== undefined ? body.dialogueEn || "" : undefined,
        dialogueEnabled: body.dialogueEnabled ?? true,
        homePosition: body.homePosition !== undefined ? body.homePosition || null : undefined,
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
    await releaseChanged(imgBefore, updated);
    return NextResponse.json({ character: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    const imgBeforeDel = await snapshotImages("ipCharacter", params.id, ["image", "backImage"]);
    await prisma.ipCharacter.delete({ where: { id: params.id } });
    await releaseChanged(imgBeforeDel, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
