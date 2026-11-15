import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// 保護所有 /admin/* 頁面（登入頁本身除外，見下方 matcher 排除規則）。
// 未登入的訪客會被導回 /admin/login；一般網站訪客完全碰不到這條路徑下的任何內容。
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
      signIn: "/admin/login",
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
