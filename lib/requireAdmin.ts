import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * 每一支「會新增/修改/刪除資料」的 API route 都必須先呼叫這個函式。
 * 沒有有效的管理員 session 就直接回傳 401，不會執行任何資料庫操作。
 *
 * 用法：
 *   const session = await requireAdmin();
 *   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}
