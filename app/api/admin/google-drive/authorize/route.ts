import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { buildAuthUrl, createOAuthClient, createState, describeError, DriveError, requireConfig, STATE_COOKIE, STATE_COOKIE_PATH, STATE_TTL_SECONDS } from "@/lib/googleDriveOAuth";

export const dynamic = "force-dynamic";

function back(req: NextRequest, q: string) {
  const base = (process.env.NEXTAUTH_URL || req.nextUrl.origin).replace(/\/+$/, "");
  return NextResponse.redirect(`${base}/admin/google-drive?${q}`);
}

/** 授權入口：只有已登入的管理員能進來；產生 state 後導向 Google。 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    const base = (process.env.NEXTAUTH_URL || req.nextUrl.origin).replace(/\/+$/, "");
    return NextResponse.redirect(`${base}/admin/login`);
  }
  const adminId = (session.user as { id?: string } | undefined)?.id ?? "";
  try {
    const cfg = requireConfig();
    const { nonce, state } = createState(adminId, cfg.stateSecret);
    const res = NextResponse.redirect(buildAuthUrl(createOAuthClient(cfg), state));
    res.cookies.set(STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: cfg.redirectUri.startsWith("https://"),
      sameSite: "lax", // callback 是 Google 導回來的頂層 GET，Lax 才帶得到 cookie
      path: STATE_COOKIE_PATH,
      maxAge: STATE_TTL_SECONDS,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("[drive-authorize]", describeError(e));
    return back(req, `error=${e instanceof DriveError ? e.code : "DRIVE_NOT_CONFIGURED"}`);
  }
}
