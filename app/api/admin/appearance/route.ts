import { releaseChanged } from "@/lib/imageRefs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_RE.test(value) ? value : fallback;
}

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

/** 圖片欄位：沒送（undefined）＝不變；送空字串／null＝清空（改存 null）；其他＝新網址。 */
function imgField(v: unknown, current: string | null): string | null {
  if (v === undefined) return current;
  if (v === null || v === "") return null;
  return String(v);
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  const body = await req.json();

  try {
    const existing = await prisma.siteSetting.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });

    const updated = await prisma.siteSetting.update({
      where: { id: "default" },
      data: {
        siteNameZh: body.siteNameZh?.trim() || existing.siteNameZh,
        siteNameEn: body.siteNameEn?.trim() || existing.siteNameEn,
        heroTitleZh: body.heroTitleZh ?? existing.heroTitleZh,
        heroTitleEn: body.heroTitleEn ?? existing.heroTitleEn,
        subtitleZh: body.subtitleZh ?? existing.subtitleZh,
        subtitleEn: body.subtitleEn ?? existing.subtitleEn,
        popularTitleZh: body.popularTitleZh ?? existing.popularTitleZh,
        popularTitleEn: body.popularTitleEn ?? existing.popularTitleEn,
        popularSubtitleZh: body.popularSubtitleZh ?? existing.popularSubtitleZh,
        popularSubtitleEn: body.popularSubtitleEn ?? existing.popularSubtitleEn,
        primaryColor: sanitizeHex(body.primaryColor, existing.primaryColor),
        secondaryColor: sanitizeHex(body.secondaryColor, existing.secondaryColor),
        backgroundColor: sanitizeHex(body.backgroundColor, existing.backgroundColor),
        textColor: sanitizeHex(body.textColor, existing.textColor),
        cardColor: sanitizeHex(body.cardColor, existing.cardColor),
        buttonColor: sanitizeHex(body.buttonColor, existing.buttonColor),
        navbarColor: sanitizeHex(body.navbarColor, existing.navbarColor),
        footerColor: sanitizeHex(body.footerColor, existing.footerColor),
        logoUrl: imgField(body.logoUrl, existing.logoUrl),
        homeHeroUrl: imgField(body.homeHeroUrl, existing.homeHeroUrl),
        homeBackgroundUrl: imgField(body.homeBackgroundUrl, existing.homeBackgroundUrl),
        homeDecorationUrl: imgField(body.homeDecorationUrl, existing.homeDecorationUrl),
        ipCharacter1Url: imgField(body.ipCharacter1Url, existing.ipCharacter1Url),
        ipCharacter2Url: imgField(body.ipCharacter2Url, existing.ipCharacter2Url),
        ipCharacter3Url: imgField(body.ipCharacter3Url, existing.ipCharacter3Url),
        footerText: body.footerText ?? existing.footerText,
      },
    });
    // 被清空／換掉的舊圖片：確認全站沒有其他地方在用才移到 uploads/_trash
    const imgFields = ["logoUrl", "homeHeroUrl", "homeBackgroundUrl", "homeDecorationUrl", "ipCharacter1Url", "ipCharacter2Url", "ipCharacter3Url"] as const;
    await releaseChanged(Object.fromEntries(imgFields.map((f) => [f, (existing as Record<string, unknown>)[f] as string | null])), updated);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}
