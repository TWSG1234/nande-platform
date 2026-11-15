import { prisma } from "@/lib/prisma";
import { releaseImage } from "@/lib/imageRefs";

/**
 * 刪除「大分類」（生活座標／校園座標共用）。
 * - 分類底下沒有資訊框 → 直接刪。
 * - 有資訊框 → 必須明確選擇：move（移到另一個分類）或 cascade（連同資訊框與它們的裝飾圖片一起刪）；沒選就回 409，什麼都不刪。
 * - 被刪資訊框的圖片：只有全站沒有其他地方使用時才移到 uploads/_trash（releaseImage 的保護）。
 */
export async function deleteCategory(scope: "campus" | "life", id: string, mode: string | null, to: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = prisma as any;
  const cat = scope === "campus" ? db.campusCategory : db.lifeCategory;
  const boxes = scope === "campus" ? db.campusSpot : db.lifeItem;
  const where = scope === "campus" ? { category: id } : { categoryId: id };
  try {
    const exists = await cat.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return { status: 404, body: { error: "找不到這個分類。" } };
    const list = await boxes.findMany({ where, select: { id: true, image: true } });
    if (list.length > 0) {
      if (mode === "move") {
        if (!to || to === id || !(await cat.findUnique({ where: { id: to }, select: { id: true } }))) return { status: 400, body: { error: "請選擇要移動到的分類。" } };
        await boxes.updateMany({ where, data: scope === "campus" ? { category: to } : { categoryId: to } });
      } else if (mode === "cascade") {
        const ids = list.map((b: { id: string }) => b.id);
        const decor = await db.infoBoxImage.findMany({ where: { scope, boxId: { in: ids } }, select: { imageUrl: true } }).catch(() => []);
        await db.infoBoxImage.deleteMany({ where: { scope, boxId: { in: ids } } }).catch(() => {});
        await boxes.deleteMany({ where: { id: { in: ids } } });
        for (const b of list) await releaseImage(b.image);
        for (const d of decor) await releaseImage(d.imageUrl);
      } else {
        return { status: 409, body: { error: `這個分類底下還有 ${list.length} 個資訊框。請選擇「移到其他分類」或「連同資訊框一起刪除」。`, count: list.length, needsChoice: true } };
      }
    }
    await cat.delete({ where: { id } });
    return { status: 200, body: { ok: true, moved: mode === "move" ? list.length : 0, deleted: mode === "cascade" ? list.length : 0 } };
  } catch (e) {
    console.error(e);
    return { status: 500, body: { error: "刪除失敗，請稍後再試一次。" } };
  }
}
