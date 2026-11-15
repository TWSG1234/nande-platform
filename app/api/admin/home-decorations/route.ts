import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { getHomeDecorations, rowToDecoration } from "@/lib/home/decorationsDb";
import { AREAS, Area, DEFAULT_DESKTOP, DEFAULT_MOBILE, cleanName, sanitizeDevice } from "@/lib/home/decorations";
import { DECOR_LIMITS } from "@/lib/home/pngCheck";
import { PngValidationError, saveDecorationPng } from "@/lib/home/decorUpload";

export const dynamic = "force-dynamic";
const unauthorized = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

function dbErrorMessage(err: unknown): string {
  const msg = String((err as Error)?.message ?? "");
  if (/does not exist|no such table|P2021/i.test(msg)) return "資料庫還沒有「首頁裝飾圖樣」資料表。請先在專案資料夾執行 npm run db:push（會自動備份），再重試。";
  return "儲存失敗，請稍後再試一次。";
}

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  return NextResponse.json({ items: await getHomeDecorations(), limits: DECOR_LIMITS });
}

const parseJson = (v: unknown) => {
  if (typeof v !== "string" || !v) return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
};

/** 新增一張裝飾圖樣：必須附透明底 PNG。 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();
  let form: { get(k: string): unknown };
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "上傳內容無法讀取，請重新選擇檔案。" }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
    return NextResponse.json({ error: "請選擇要上傳的透明底 PNG。" }, { status: 400 });
  }
  let saved;
  try {
    saved = await saveDecorationPng(file as File);
  } catch (err) {
    if (err instanceof PngValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "檔案存入固定資料夾失敗，請確認資料夾可寫入後再試。" }, { status: 500 });
  }
  const areaRaw = form.get("area");
  const area: Area = AREAS.includes(areaRaw as Area) ? (areaRaw as Area) : "hero";
  try {
    const max = await prisma.homeDecoration.aggregate({ _max: { sortOrder: true } }).catch(() => null);
    const row = await prisma.homeDecoration.create({
      data: {
        name: cleanName(form.get("name")) || cleanName(String((file as File).name).replace(/\.png$/i, "")) || "裝飾圖樣",
        imageUrl: saved.url,
        naturalWidth: saved.width,
        naturalHeight: saved.height,
        isVisible: true,
        area,
        sortOrder: ((max as { _max?: { sortOrder?: number | null } } | null)?._max?.sortOrder ?? -1) + 1,
        desktopJson: JSON.stringify(sanitizeDevice(parseJson(form.get("desktop")), DEFAULT_DESKTOP)),
        mobileJson: JSON.stringify(sanitizeDevice(parseJson(form.get("mobile")), DEFAULT_MOBILE)),
      },
    });
    return NextResponse.json({ item: rowToDecoration(row as unknown as Record<string, unknown>) });
  } catch (err) {
    console.error(err);
    await getStorage().remove(saved.url); // 設定沒存成功：新檔移到 _trash，不留孤兒檔
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
