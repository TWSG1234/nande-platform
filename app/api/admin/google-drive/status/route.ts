import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { prismaDriveAuthStore, statusSummary } from "@/lib/googleDriveOAuth";

export const dynamic = "force-dynamic";

/** 授權狀態（絕不回傳 token、Client Secret 或加密金鑰）。 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "請先登入管理後台。" }, { status: 401 });
  return NextResponse.json(await statusSummary({ store: prismaDriveAuthStore(prisma) }), { headers: { "Cache-Control": "no-store" } });
}
