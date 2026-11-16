import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { describeError, DriveError, prismaDriveAuthStore, testConnection } from "@/lib/googleDriveOAuth";

export const dynamic = "force-dynamic";

/** 檢查連線：換 Access Token 並確認資料夾可寫入，不建立任何檔案。 */
export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  try {
    const r = await testConnection({ store: prismaDriveAuthStore(prisma) });
    return NextResponse.json({ ok: true, folderName: r.name });
  } catch (e) {
    console.error("[drive-test]", describeError(e));
    if (e instanceof DriveError) return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: 409 });
    return NextResponse.json({ ok: false, error: "檢查連線時發生未知問題。", code: "DRIVE_UPLOAD_FAILED" }, { status: 500 });
  }
}
