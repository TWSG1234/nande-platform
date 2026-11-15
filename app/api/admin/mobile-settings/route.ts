import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const CHARACTER_IDS = ["characterA", "characterB", "characterC"] as const;

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const home = await prisma.mobileHomeSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  // 保證三隻角色的設定列一定存在，第一次進這個頁面時自動補上預設值。
  const characters = await Promise.all(
    CHARACTER_IDS.map((id, i) =>
      prisma.mobileIpCharacterSetting.upsert({
        where: { id },
        update: {},
        create: { id, order: i },
      })
    )
  );

  return NextResponse.json({ home, characters });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();

  try {
    const home = await prisma.mobileHomeSetting.upsert({
      where: { id: "default" },
      update: {
        showQuickLinks: Boolean(body.home?.showQuickLinks),
        showIpRow: Boolean(body.home?.showIpRow),
        showAnnouncements: Boolean(body.home?.showAnnouncements),
      },
      create: {
        id: "default",
        showQuickLinks: Boolean(body.home?.showQuickLinks),
        showIpRow: Boolean(body.home?.showIpRow),
        showAnnouncements: Boolean(body.home?.showAnnouncements),
      },
    });

    const characters = await Promise.all(
      (body.characters || []).map((c: Record<string, unknown>) => {
        if (!CHARACTER_IDS.includes(c.id as (typeof CHARACTER_IDS)[number])) return null;
        return prisma.mobileIpCharacterSetting.upsert({
          where: { id: c.id as string },
          update: {
            isVisible: Boolean(c.isVisible),
            order: Number(c.order) || 0,
            sizeScale: Number(c.sizeScale) || 1,
            animationEnabled: Boolean(c.animationEnabled),
            animationAmplitude: Number(c.animationAmplitude) || 0,
            animationDuration: Number(c.animationDuration) || 3,
          },
          create: {
            id: c.id as string,
            isVisible: Boolean(c.isVisible),
            order: Number(c.order) || 0,
            sizeScale: Number(c.sizeScale) || 1,
            animationEnabled: Boolean(c.animationEnabled),
            animationAmplitude: Number(c.animationAmplitude) || 0,
            animationDuration: Number(c.animationDuration) || 3,
          },
        });
      })
    );

    return NextResponse.json({ home, characters: characters.filter(Boolean) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
