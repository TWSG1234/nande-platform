import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * 管理員登入設定。
 *
 * - 密碼絕不明文儲存：資料庫只存 bcrypt 雜湊值（見 prisma/seed.ts 建立帳號的方式）。
 * - 登入狀態用 JWT session，由 NextAuth 在伺服器端簽章驗證，前端拿不到任何密鑰。
 * - middleware.ts 會用這裡的 session 保護所有 /admin/* 路由；一般訪客完全碰不到
 *   管理 API（見 lib/requireAdmin.ts）。
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!admin) return null;

        const valid = await bcrypt.compare(credentials.password, admin.passwordHash);
        if (!valid) return null;

        return { id: admin.id, email: admin.email, name: admin.name ?? admin.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.adminId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.adminId as string;
      }
      return session;
    },
  },
};
