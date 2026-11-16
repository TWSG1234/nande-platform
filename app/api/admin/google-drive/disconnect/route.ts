import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { describeError, disconnect, DriveError, prismaDriveAuthStore } from "@/lib/googleDriveOAuth";

export const dynamic = "force-dynamic";

/** 中斷連線：向 Google 撤銷 Refresh Token 並刪除本地加密紀錄。不會動 Drive 上任何檔案、也不動投稿資料。 */
export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  try {
    await disconnect({ store: prismaDriveAuthStore(prisma) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[drive-disconnect]", describeError(e));
    return NextResponse.json({ ok: false, error: e instanceof DriveError ? e.message : "中斷連線失敗。" }, { status: 500 });
  }
}
