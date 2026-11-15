import { prisma } from "@/lib/prisma";
import type { AnimationFormat } from "./correctAnimation";

/**
 * 每一關的答題成功動畫（以 ChineseStage.id 關聯）。伺服器端專用。
 * 讀取在資料表還沒建立（尚未 npm run db:push）或任何錯誤時回傳 null＝「這一關沒有動畫」，
 * 所以中文學習頁與答題功能完全不受影響。
 */
export type StageAnimation = {
  stageId: string;
  fileUrl: string;
  fileName: string;
  format: AnimationFormat;
  mimeType: string;
  sizeBytes: number;
  updatedAt: Date | null;
};

export function normalizeRow(row: Record<string, unknown> | null): StageAnimation | null {
  if (!row) return null;
  const format = row.format === "mp4" || row.format === "gif" || row.format === "svg" ? row.format : null;
  const fileUrl = typeof row.fileUrl === "string" ? row.fileUrl : "";
  if (!format || !fileUrl || typeof row.stageId !== "string") return null;
  return {
    stageId: row.stageId,
    fileUrl,
    fileName: typeof row.fileName === "string" ? row.fileName : "",
    format,
    mimeType: typeof row.mimeType === "string" ? row.mimeType : "",
    sizeBytes: typeof row.sizeBytes === "number" ? row.sizeBytes : 0,
    updatedAt: (row.updatedAt as Date) ?? null,
  };
}

export const validStageId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

export async function getStageAnimation(stageId: string): Promise<StageAnimation | null> {
  if (!validStageId(stageId)) return null;
  try {
    const row = await prisma.chineseStageAnimation.findUnique({ where: { stageId } });
    return normalizeRow(row as unknown as Record<string, unknown> | null);
  } catch (err) {
    const e = err as { code?: string; message?: string } | null;
    // 資料表還沒建立（尚未 npm run db:push）、或 Prisma 還沒產生這張表的存取介面：這一關暫時沒有動畫。
    if (e instanceof TypeError || e?.code === "P2021" || /does not exist|no such table/i.test(String(e?.message ?? ""))) {
      console.warn("[chinese-animation] 資料表可能尚未建立，請執行 npm run db:push，這一關暫不播動畫：", e?.message);
      return null;
    }
    // 其他錯誤（資料庫暫時鎖住、連線失敗…）是暫時性的：不能當成「沒有動畫」，往上丟，API 會回 503，前台會重試。
    throw err;
  }
}

export async function saveStageAnimation(a: Omit<StageAnimation, "updatedAt">): Promise<void> {
  const { stageId, ...rest } = a;
  await prisma.chineseStageAnimation.upsert({ where: { stageId }, create: { stageId, ...rest }, update: { ...rest } });
}

export async function deleteStageAnimation(stageId: string): Promise<void> {
  await prisma.chineseStageAnimation.deleteMany({ where: { stageId } });
}

export const versionOf = (a: StageAnimation) => (a.updatedAt ? a.updatedAt.getTime() : 0);
