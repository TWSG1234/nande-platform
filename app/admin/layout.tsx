import AdminProviders from "@/components/admin/AdminProviders";

export const metadata = {
  title: "管理後台｜南得遇見你",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviders>
      <div className="min-h-screen bg-canvas-light dark:bg-canvas-dark text-ink-900 dark:text-ink-50 transition-colors">
        {children}
      </div>
    </AdminProviders>
  );
}
