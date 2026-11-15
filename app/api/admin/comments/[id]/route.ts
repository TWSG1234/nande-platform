import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });

  try {
    // Soft delete：只標記 isDeleted = true，不會真的從資料庫移除，
    // 公開 API（/api/photos/[id]/comments）查詢時已經加了 isDeleted: false 的條件，
    // 刪除後的留言就不會再出現在公開頁面。
    await prisma.comment.update({ where: { id: params.id }, data: { isDeleted: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "刪除失敗，請稍後再試一次。" }, { status: 500 });
  }
}
