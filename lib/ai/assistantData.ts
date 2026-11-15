import { prisma } from "@/lib/prisma";
import { DEFAULT_ASSISTANT_RULES, DEFAULT_ASSISTANT_SETTINGS } from "./defaults";
import { sanitizeSettings } from "./validate";
import type { AssistantPublicConfig, AssistantRuleData, AssistantSettings } from "./types";

/**
 * 伺服器端資料存取（不要在 client component 匯入）。
 * 所有「讀」的函式在資料表不存在或沒有資料時都回傳預設值，所以即使還沒執行
 * 資料庫更新指令，網站其他部分與小助理（用預設值）仍可正常運作。
 */

type SettingRow = AssistantSettings & { id: string; updatedAt: Date };

/**
 * 三個「動作圖片」欄位是後來才新增的。資料庫還沒執行 npm run db:push 之前，Prisma 預設選取全部欄位會丟錯，
 * 會讓助理設定與規則整個退回預設值。所以讀取時若因缺這幾個欄位失敗，就改用「不含它們」的欄位清單重試。
 */
export const ACTION_IMAGE_FIELDS = ["thinkingImageUrl", "unresolvedImageUrl", "lifeInfoImageUrl"] as const;
export function isMissingActionImageColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const msg = String(e?.message ?? "");
  return (e?.code === "P2022" || /no such column|does not exist in the current database/i.test(msg)) && /ImageUrl/.test(msg);
}
/** 不含動作圖片欄位的 select（欄位清單取自預設設定，新增欄位時不會漏）。 */
export function settingsSelectWithoutActionImages() {
  const sel: Record<string, true> = { id: true, updatedAt: true };
  for (const k of Object.keys(DEFAULT_ASSISTANT_SETTINGS)) {
    if (!(ACTION_IMAGE_FIELDS as readonly string[]).includes(k)) sel[k] = true;
  }
  return sel;
}

export async function getAssistantSettings(): Promise<{ settings: AssistantSettings; updatedAt: Date | null }> {
  try {
    let row: SettingRow | null;
    try {
      row = (await prisma.assistantSetting.findUnique({ where: { id: "default" } })) as SettingRow | null;
    } catch (err) {
      if (!isMissingActionImageColumn(err)) throw err;
      console.warn("[assistant] 動作圖片欄位尚未建立，暫時不使用動作圖片設定（請執行 npm run db:push）。");
      row = (await prisma.assistantSetting.findUnique({ where: { id: "default" }, select: settingsSelectWithoutActionImages() })) as SettingRow | null;
    }
    if (!row) return { settings: DEFAULT_ASSISTANT_SETTINGS, updatedAt: null };
    return { settings: sanitizeSettings(row), updatedAt: row.updatedAt };
  } catch (err) {
    console.error("[assistant] getAssistantSettings fell back to defaults:", err);
    return { settings: DEFAULT_ASSISTANT_SETTINGS, updatedAt: null };
  }
}

export async function getAssistantRules(): Promise<AssistantRuleData[]> {
  const defaults = DEFAULT_ASSISTANT_RULES.map((r, i) => ({ ...r, id: `default-${i}` }));
  try {
    // 設定列不存在＝管理員從未儲存過 → 使用預設規則；
    // 設定列存在＝以資料庫為準（即使管理員刪光規則，也尊重他的選擇）。
    const setting = await prisma.assistantSetting.findUnique({ where: { id: "default" }, select: { id: true } });
    if (!setting) return defaults;
    const rows = (await prisma.assistantRule.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] })) as AssistantRuleData[];
    return rows;
  } catch (err) {
    console.error("[assistant] getAssistantRules fell back to defaults:", err);
    return defaults;
  }
}

/** 給前台 layout 用：設定 + 版本戳。 */
export async function getAssistantPublicConfig(): Promise<AssistantPublicConfig> {
  const { settings, updatedAt } = await getAssistantSettings();
  return { settings, version: updatedAt ? updatedAt.toISOString() : "default" };
}
