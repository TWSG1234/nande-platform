import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { ACTION_IMAGE_FIELDS, getAssistantRules, getAssistantSettings, isMissingActionImageColumn } from "@/lib/ai/assistantData";
import { deleteLocalImage } from "@/lib/uploadImage";
import { DEFAULT_ASSISTANT_RULES, DEFAULT_ASSISTANT_SETTINGS } from "@/lib/ai/defaults";
import { sanitizeRules, sanitizeSettings } from "@/lib/ai/validate";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

/** 讀取目前設定與規則（沒有儲存過就回傳預設值，不寫入資料庫）。 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { settings } = await getAssistantSettings();
  const rules = await getAssistantRules();
  return NextResponse.json({
    settings,
    rules,
    defaults: { settings: DEFAULT_ASSISTANT_SETTINGS, rules: DEFAULT_ASSISTANT_RULES },
  });
}

/** 一次儲存設定 + 全部規則（規則清單的順序＝優先順序）。 */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  let body: { settings?: unknown; rules?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "資料格式錯誤。" }, { status: 400 });
  }
  const settings = sanitizeSettings(body.settings);
  const rules = sanitizeRules(body.rules);

  // 舊的動作圖片網址（欄位尚未建立時讀不到，視為沒有）
  const before = (await getAssistantSettings()).settings;

  const save = (data: Record<string, unknown>) =>
    prisma.$transaction([
      prisma.assistantSetting.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
        select: { id: true },
      }),
      // 只清掉「小助理規則」這張表，並以編輯器送來的完整清單取代。
      prisma.assistantRule.deleteMany({}),
      prisma.assistantRule.createMany({ data: rules }),
    ]);

  let imagesSaved = true;
  try {
    try {
      await save(settings as unknown as Record<string, unknown>);
    } catch (err) {
      if (!isMissingActionImageColumn(err)) throw err;
      // 資料庫還沒有動作圖片欄位：其他設定照常儲存，動作圖片要等 npm run db:push 之後才能存
      const rest: Record<string, unknown> = { ...settings };
      for (const k of ACTION_IMAGE_FIELDS) delete rest[k];
      await save(rest);
      imagesSaved = false;
    }
  } catch (err) {
    console.error("[assistant] save failed:", err);
    return NextResponse.json(
      { error: "儲存失敗。若這是第一次使用此功能，請先在專案資料夾執行 npm run db:push 建立資料表，再重試。" },
      { status: 500 }
    );
  }

  // 動作圖片被更換或移除：舊檔只是移到 uploads/_trash（可找回），不是永久刪除
  if (imagesSaved) {
    for (const k of ACTION_IMAGE_FIELDS) {
      const oldUrl = before[k];
      if (oldUrl && oldUrl !== settings[k]) {
        try {
          await deleteLocalImage(oldUrl);
        } catch (err) {
          console.error("[assistant] 舊動作圖片移到回收資料夾失敗（不影響儲存）：", err);
        }
      }
    }
  }

  revalidatePath("/", "layout");
  const saved = await getAssistantSettings();
  return NextResponse.json({
    settings: saved.settings,
    rules: await getAssistantRules(),
    ...(imagesSaved ? {} : { warning: "動作圖片還沒有儲存：資料庫需要先執行一次 npm run db:push（只新增三個欄位、會自動備份），再重新儲存。其他設定已儲存。" }),
  });
}
