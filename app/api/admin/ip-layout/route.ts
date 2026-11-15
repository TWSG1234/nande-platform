import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { heroCharacters } from "@/lib/data/heroCharacters";
import { getIpLayouts } from "@/lib/home/ipLayoutDb";
import { IP_CHAR_IDS, IP_CHAR_NAMES, IP_DEVICES, IpDevice, defaultLayouts, defaultSettings, sanitizeIpDevice, MobileIpPrefs } from "@/lib/home/ipLayout";
import { resolveHeroImages } from "@/lib/home/ipImages";

const needAdmin = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
const TABLE_MSG = "IP 角色版面資料表尚未建立，請先關閉網站、執行 npm run db:push（會自動先備份資料庫），再重新啟動。";

async function mobilePrefs(): Promise<MobileIpPrefs[] | undefined> {
  try {
    const rows = await prisma.mobileIpCharacterSetting.findMany();
    return rows.length ? rows.map((r) => ({ id: r.id as MobileIpPrefs["id"], isVisible: r.isVisible, order: r.order, sizeScale: r.sizeScale })) : undefined;
  } catch {
    return undefined;
  }
}

async function snapshot() {
  const prefs = await mobilePrefs();
  const { layouts, saved, tableReady } = await getIpLayouts(prefs);
  let appearance: Record<string, string | null> = {};
  try {
    const row = await prisma.siteSetting.findUnique({ where: { id: "default" } });
    if (row) appearance = { ipCharacter1Url: row.ipCharacter1Url, ipCharacter2Url: row.ipCharacter2Url, ipCharacter3Url: row.ipCharacter3Url };
  } catch {
    /* 讀不到就視為沒有自訂圖片 */
  }
  return {
    layouts,
    saved,
    tableReady,
    defaults: defaultLayouts(prefs),
    images: resolveHeroImages(appearance),
    builtIn: heroCharacters,
    names: IP_CHAR_NAMES,
  };
}

export async function GET() {
  if (!(await requireAdmin())) return needAdmin();
  return NextResponse.json(await snapshot());
}

/** 儲存「一種裝置」的三隻角色版面。body：{ device, items: { characterA: {...}, ... } }。其他兩種裝置完全不動。 */
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return needAdmin();
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "送出的內容無法讀取。" }, { status: 400 });
  }
  const device = body.device as IpDevice;
  if (!IP_DEVICES.includes(device)) return NextResponse.json({ error: "裝置類型不正確（桌機／平板／手機）。" }, { status: 400 });
  if (!body.items || typeof body.items !== "object") return NextResponse.json({ error: "沒有收到角色設定。" }, { status: 400 });

  const prefs = await mobilePrefs();
  const col = `${device}Json` as "desktopJson" | "tabletJson" | "mobileJson";
  try {
    for (const id of IP_CHAR_IDS) {
      if (body.items[id] === undefined) continue; // 沒送的角色不動
      const clean = sanitizeIpDevice(body.items[id], defaultSettings(device, id, prefs));
      await prisma.ipHeroLayout.upsert({
        where: { id },
        update: { [col]: JSON.stringify(clean) },
        create: { id, [col]: JSON.stringify(clean) },
      });
    }
    return NextResponse.json(await snapshot());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: /does not exist|no such table|P2021/i.test(String((err as Error)?.message) + String((err as { code?: string })?.code)) || err instanceof TypeError ? TABLE_MSG : "儲存失敗，請稍後再試一次。" }, { status: 500 });
  }
}

/** 恢復預設：?device=desktop|tablet|mobile，只清掉該裝置已儲存的設定（改回該裝置自己的預設值）。 */
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return needAdmin();
  const device = new URL(req.url).searchParams.get("device") as IpDevice;
  if (!IP_DEVICES.includes(device)) return NextResponse.json({ error: "裝置類型不正確（桌機／平板／手機）。" }, { status: 400 });
  const col = `${device}Json` as "desktopJson" | "tabletJson" | "mobileJson";
  try {
    for (const id of IP_CHAR_IDS) {
      const row = await prisma.ipHeroLayout.findUnique({ where: { id } });
      if (row) await prisma.ipHeroLayout.update({ where: { id }, data: { [col]: null } });
    }
    return NextResponse.json(await snapshot());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "恢復預設失敗，請稍後再試一次。" }, { status: 500 });
  }
}
