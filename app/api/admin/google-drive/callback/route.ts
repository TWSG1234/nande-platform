import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { completeAuthorization, describeError, DriveError, prismaDriveAuthStore, requireConfig, STATE_COOKIE, STATE_COOKIE_PATH, verifyState } from "@/lib/googleDriveOAuth";

export const dynamic = "force-dynamic";

/** Google 授權完成後導回這裡。必須是已登入管理員，且 state 必須與當初簽發的相符。 */
export async function GET(req: NextRequest) {
  const base = (process.env.NEXTAUTH_URL || req.nextUrl.origin).replace(/\/+$/, "");
  const done = (q: string) => {
    const res = NextResponse.redirect(`${base}/admin/google-drive?${q}`);
    res.cookies.set(STATE_COOKIE, "", { path: STATE_COOKIE_PATH, maxAge: 0 }); // state 只能用一次
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  const session = await requireAdmin();
  if (!session) return NextResponse.redirect(`${base}/admin/login`);
  const adminId = (session.user as { id?: string } | undefined)?.id ?? "";

  const sp = req.nextUrl.searchParams;
  try {
    const cfg = requireConfig();
    // 先驗 state，再處理其他任何參數（包含 Google 回傳的 error）
    const ok = verifyState({ state: sp.get("state"), cookieNonce: req.cookies.get(STATE_COOKIE)?.value ?? null, adminId, secret: cfg.stateSecret });
    if (!ok) throw new DriveError("DRIVE_STATE_INVALID");
    if (sp.get("error")) throw new DriveError("DRIVE_ACCESS_DENIED");
    const code = sp.get("code");
    if (!code) throw new DriveError("DRIVE_EXCHANGE_FAILED", "缺少授權碼");
    await completeAuthorization(code, adminId || null, { store: prismaDriveAuthStore(prisma) });
    return done("result=ok");
  } catch (e) {
    console.error("[drive-callback]", describeError(e));
    return done(`error=${e instanceof DriveError ? e.code : "DRIVE_EXCHANGE_FAILED"}`);
  }
}
