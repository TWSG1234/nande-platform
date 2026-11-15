import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { ANIMATION_LIMITS, AnimationValidationError, LIMIT_TEXT, validateAnimationFile } from "@/lib/chinese/correctAnimation";
import { deleteStageAnimation, getStageAnimation, saveStageAnimation, StageAnimation, validStageId, versionOf } from "@/lib/chinese/correctAnimationDb";
import { analyzeSvgAnimation } from "@/lib/chinese/svgAnim";
import { ANIMATION_SUBDIR } from "@/lib/storage/localPath";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
const MAX_ANY = Math.max(...Object.values(ANIMATION_LIMITS));

function publicView(a: StageAnimation | null) {
  return a
    ? {
        configured: true,
        fileName: a.fileName,
        format: a.format,
        sizeBytes: a.sizeBytes,
        previewSrc: `/api/chinese/correct-animation/file?stageId=${encodeURIComponent(a.stageId)}&v=${versionOf(a)}`,
        updatedAt: a.updatedAt ? a.updatedAt.toISOString() : null,
      }
    : { configured: false, fileName: "", format: "", sizeBytes: 0, previewSrc: "", updatedAt: null };
}

function dbErrorMessage(err: unknown): string {
  const msg = String((err as Error)?.message ?? "");
  if (/does not exist|no such table|P2021/i.test(msg)) return "資料庫還沒有「關卡答題動畫」設定表。請先在專案資料夾執行 npm run db:push（會自動備份），再重試。";
  return "儲存設定失敗，請稍後再試一次。";
}

async function stageExists(stageId: string): Promise<boolean> {
  try {
    return !!(await prisma.chineseStage.findUnique({ where: { id: stageId }, select: { id: true } }));
  } catch {
    return false;
  }
}

async function resolveStage(stageId: unknown): Promise<NextResponse | null> {
  if (!validStageId(stageId)) return NextResponse.json({ error: "缺少或不正確的關卡編號。" }, { status: 400 });
  if (!(await stageExists(stageId))) return NextResponse.json({ error: "找不到這個關卡，可能已被刪除。請重新整理頁面。" }, { status: 404 });
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();
  const stageId = new URL(req.url).searchParams.get("stageId");
  const bad = await resolveStage(stageId);
  if (bad) return bad;
  let cur: StageAnimation | null;
  try {
    cur = await getStageAnimation(stageId!);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "讀取動畫設定失敗，請稍後重新整理。" }, { status: 500 });
  }
  const view: Record<string, unknown> = { ...publicView(cur), limitText: LIMIT_TEXT };
  // 設定還在、檔案卻不見了：讓後台明確看到（前台這一關會暫時不播動畫）
  if (cur) view.fileMissing = !(await getStorage().exists(cur.fileUrl).catch(() => false));
  if (cur && cur.format === "svg") {
    // 讓後台看得出這個 SVG 是靜態還是動畫，以及舊檔是否不符合新規則（前台不會播放）
    const data = await getStorage().read(cur.fileUrl).catch(() => null);
    const info = data ? analyzeSvgAnimation(data.toString("utf8")) : null;
    view.svgKind = info ? info.kind : "unreadable";
    if (info?.kind === "animated") view.svgSeconds = Math.round(info.durationMs / 100) / 10;
    if (info?.kind === "unsupported") view.svgProblem = info.reason;
  }
  return NextResponse.json(view);
}

/** 上傳（或更換）「這一關」的動畫：只動這一關的設定與檔案，其他關卡不受影響。 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  let form: { get(k: string): unknown };
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "上傳內容無法讀取，請重新選擇檔案。" }, { status: 400 });
  }
  const stageId = form.get("stageId");
  const bad = await resolveStage(stageId);
  if (bad) return bad;
  const sid = stageId as string;

  const file = form.get("file");
  if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
    return NextResponse.json({ error: "請選擇要上傳的動畫檔（MP4、GIF 或 SVG）。" }, { status: 400 });
  }
  const f = file as File;
  if (f.size > MAX_ANY) {
    return NextResponse.json({ error: `檔案太大（${(f.size / 1024 / 1024).toFixed(1)} MB）。${LIMIT_TEXT}。` }, { status: 400 });
  }

  let data: Buffer;
  let validated;
  try {
    data = Buffer.from(await f.arrayBuffer());
    validated = validateAnimationFile({ name: f.name, declaredType: f.type, data });
  } catch (err) {
    if (err instanceof AnimationValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "檔案讀取失敗，請重新選擇。" }, { status: 400 });
  }

  const storage = getStorage();
  let previous: StageAnimation | null;
  try {
    previous = await getStageAnimation(sid);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "讀取目前的動畫設定失敗，沒有做任何變更，請稍後再試。" }, { status: 500 });
  }
  let url: string;
  try {
    url = await storage.put(ANIMATION_SUBDIR, `${randomUUID()}.${validated.ext}`, data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "檔案存入固定資料夾失敗，請確認資料夾可寫入後再試。" }, { status: 500 });
  }

  try {
    await saveStageAnimation({
      stageId: sid,
      fileUrl: url,
      fileName: String(f.name).replace(/[\u0000-\u001f<>]/g, "").slice(0, 120),
      format: validated.format,
      mimeType: validated.mime,
      sizeBytes: data.length,
    });
  } catch (err) {
    console.error(err);
    await storage.remove(url); // 設定沒存成功，新檔移到 _trash，不留孤兒檔
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }

  // 舊檔（只屬於這一關，檔名是 UUID，不會被其他關卡共用）移到 _trash
  if (previous?.fileUrl && previous.fileUrl !== url) await storage.remove(previous.fileUrl);
  return NextResponse.json(publicView(await getStageAnimation(sid).catch(() => null)));
}

/** 移除「這一關」的動畫：這一關恢復只顯示文字回饋。檔案移到 uploads/_trash（可找回），不真的刪除。 */
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();
  const stageId = new URL(req.url).searchParams.get("stageId");
  const bad = await resolveStage(stageId);
  if (bad) return bad;
  let previous: StageAnimation | null;
  try {
    previous = await getStageAnimation(stageId!);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "讀取目前的動畫設定失敗，沒有做任何變更，請稍後再試。" }, { status: 500 });
  }
  try {
    await deleteStageAnimation(stageId!);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
  if (previous?.fileUrl) await getStorage().remove(previous.fileUrl);
  return NextResponse.json(publicView(null));
}
