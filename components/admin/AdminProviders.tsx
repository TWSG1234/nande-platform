"use client";

import { SessionProvider } from "next-auth/react";

// 只包在 /admin 底下用，不動到 components/Providers.tsx（公開網站不需要 session）。
export default function AdminProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
