import { prisma } from "@/lib/prisma";

/**
 * 「照片牆」公開 API 共用的安全邏輯。
 *
 * 兩件事這裡一次處理好，其他 API route 都重複用這兩個函式，不要各自寫一次：
 *  1. 永遠只查 status = "approved" 的投稿 —— PENDING / REJECTED 不會被這裡的
 *     任何函式回傳，呼叫端不需要、也不應該自己再過濾一次 status。
 *  2. 回傳的欄位是白名單，不是把整個資料庫欄位丟出去 —— reviewerId、
 *     rejectionReason、rejectionNote 這些內部審核資訊永遠不會出現在公開
 *     API 的回應裡，就算以後 PhotoSubmission 這張表又加了新的內部欄位，
 *     這裡沒有明確列出來的欄位就不會外流。
 */

/**
 * 中文／英文互相 fallback：哪一個語言有內容就用哪個，兩個都有就各自顯示
 * 各自的，都沒有的話回傳空字串（呼叫端再視情況處理，例如照片說明本來就
 * 選填）。不要只處理「英文缺少 fallback 回中文」單一方向——投稿者也可能
 * 只填了英文、中文是空的，這時候中文模式要能 fallback 顯示英文，不能讓
 * 卡片看起來像沒有標題。
 */
function pickBilingual(zh: string | null | undefined, en: string | null | undefined): { "zh-TW": string; en: string } {
  const zhVal = zh?.trim() || "";
  const enVal = en?.trim() || "";
  return { "zh-TW": zhVal || enVal, en: enVal || zhVal };
}

export function toPublicPhoto(row: {
  id: string;
  previewUrl: string | null;
  title: string;
  titleEn: string;
  caption: string | null;
  captionEn: string | null;
  createdAt: Date;
  _count?: { comments: number };
}) {
  const title = pickBilingual(row.title, row.titleEn);
  const caption = pickBilingual(row.caption, row.captionEn);
  return {
    id: row.id,
    imageUrl: row.previewUrl,
    title,
    caption: caption["zh-TW"] || caption.en ? caption : null,
    createdAt: row.createdAt,
    commentCount: row._count?.comments ?? 0,
  };
}

export async function getApprovedPhotos() {
  const rows = await prisma.photoSubmission.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { comments: { where: { isDeleted: false } } } } },
  });
  return rows.map(toPublicPhoto);
}

export async function getApprovedPhoto(id: string) {
  const row = await prisma.photoSubmission.findUnique({
    where: { id },
    include: { _count: { select: { comments: { where: { isDeleted: false } } } } },
  });
  if (!row || row.status !== "approved") return null; // PENDING/REJECTED 一律當作不存在
  return toPublicPhoto(row);
}

/** 用在詳情頁第一次渲染（Server Component），之後留言區的即時更新走 /api/photos/[id]/comments。 */
export async function getVisibleComments(photoId: string) {
  return prisma.comment.findMany({
    where: { photoId, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, nickname: true, content: true, createdAt: true },
  });
}
