import AdminShell from "@/components/admin/AdminShell";
import { getSiteAppearance } from "@/lib/serverData";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const appearance = await getSiteAppearance();
  return <AdminShell siteName={appearance.siteNameZh}>{children}</AdminShell>;
}
