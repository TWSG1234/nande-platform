/**
 * 圖片「清空／更換／刪除項目」之後的實體檔案處理（伺服器端專用）。
 *
 * 原則：欄位的關聯一定先清掉（由各 API 自己更新資料庫），這裡只決定「那個舊檔案要不要移到 uploads/_trash」。
 *  - 只處理站內上傳檔（/uploads/...）；網址型、內建圖片（/images/...）一律略過。
 *  - 先掃描全站所有已知的圖片欄位：只要還有任何地方在用同一個網址，就保留檔案（不動）。
 *  - 掃描過程出現「無法確定」的錯誤（資料庫讀取失敗等）一律保留檔案，寧可多留不要誤刪。
 *  - 即使要清理，也只是移到 uploads/_trash（可找回），不真正刪除。
 *  - 本函式永遠不丟錯：圖片清理失敗不影響使用者剛剛的儲存／刪除操作。
 */
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

/** 全站所有會存「圖片網址」的欄位（新增圖片欄位時請一併加進來，否則清空時會保守地不處理）。 */
export const IMAGE_REFERENCES: { model: string; fields: string[] }[] = [
  { model: "announcement", fields: ["image"] },
  { model: "campusSpot", fields: ["image"] },
  { model: "lifeItem", fields: ["image"] },
  { model: "chineseLevel", fields: ["image"] },
  { model: "chinesePage", fields: ["comicImages", "comicImagesEn"] },
  { model: "calendarEvent", fields: ["imageUrl"] },
  { model: "ipCharacter", fields: ["image", "backImage"] },
  { model: "siteSetting", fields: ["logoUrl", "homeHeroUrl", "homeBackgroundUrl", "homeDecorationUrl", "ipCharacter1Url", "ipCharacter2Url", "ipCharacter3Url"] },
  { model: "teamMember", fields: ["photo"] },
  { model: "partner", fields: ["logo"] },
  { model: "photoSubmission", fields: ["previewUrl"] },
  { model: "officialImage", fields: ["url"] },
  { model: "assistantSetting", fields: ["imageUrl", "thinkingImageUrl", "unresolvedImageUrl", "lifeInfoImageUrl"] },
  { model: "chineseStageAnimation", fields: ["fileUrl"] },
  { model: "chineseCorrectAnimation", fields: ["fileUrl"] },
  { model: "homeDecoration", fields: ["imageUrl"] },
  { model: "assistantQuestionType", fields: ["imageUrl"] },
  { model: "infoBoxImage", fields: ["imageUrl"] },
];

const isMissingStructure = (err: unknown) => {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === "P2021" || e?.code === "P2022" || /does not exist|no such (table|column)/i.test(String(e?.message ?? ""));
};

/** true＝還有地方在用；false＝確定沒人在用；丟錯＝無法確定。 */
export async function isImageReferenced(url: string): Promise<boolean> {
  const db = prisma as unknown as Record<string, { findFirst: (a: unknown) => Promise<unknown> }>;
  for (const { model, fields } of IMAGE_REFERENCES) {
    try {
      const hit = await db[model]!.findFirst({ where: { OR: fields.map((f) => ({ [f]: { contains: url } })) }, select: { [fields[0]!]: true } });
      if (hit) return true;
    } catch (err) {
      if (isMissingStructure(err)) continue; // 那張表／欄位還沒建立＝不可能有引用
      throw err;
    }
  }
  return false;
}

export type ReleaseResult = "skipped" | "kept-shared" | "kept-unsure" | "trashed";

export async function releaseImage(oldUrl: string | null | undefined, newUrl?: string | null): Promise<ReleaseResult> {
  try {
    if (!oldUrl || oldUrl === newUrl || !oldUrl.startsWith("/uploads/")) return "skipped";
    if (await isImageReferenced(oldUrl)) return "kept-shared";
    await getStorage().remove(oldUrl);
    return "trashed";
  } catch (err) {
    console.warn("[images] 無法確認圖片是否仍被使用，保留檔案不動：", (err as Error)?.message);
    return "kept-unsure";
  }
}

/** 讀出某筆資料「目前」的圖片欄位（更新前呼叫）。讀不到就回傳空物件（＝之後不會清理任何檔案）。 */
export async function snapshotImages(model: string, id: string, fields: string[]): Promise<Record<string, string | null>> {
  try {
    const db = prisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> }>;
    const row = await db[model]!.findUnique({ where: { id }, select: Object.fromEntries(fields.map((f) => [f, true])) });
    const out: Record<string, string | null> = {};
    for (const f of fields) out[f] = typeof row?.[f] === "string" ? (row![f] as string) : null;
    return out;
  } catch {
    return {};
  }
}

/** 更新（或刪除）之後呼叫：只要某欄位的網址有變（被換掉或清空），就檢查舊檔案能不能清理。 */
export async function releaseChanged(before: Record<string, string | null>, after: Record<string, unknown>): Promise<void> {
  for (const [f, oldUrl] of Object.entries(before)) {
    const next = typeof after[f] === "string" ? (after[f] as string) : null;
    if (oldUrl && oldUrl !== next) await releaseImage(oldUrl, next);
  }
}

/** 從 JSON 陣列字串（漫畫圖片欄位）取出所有網址。 */
export function urlsFromComicJson(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((x) => (x && typeof x.url === "string" ? x.url : null)).filter((u): u is string => !!u) : [];
  } catch {
    return [];
  }
}
