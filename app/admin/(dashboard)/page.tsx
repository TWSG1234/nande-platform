import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CALENDAR_BASE_SELECT } from "@/lib/calendarDb";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [pendingUploads, publishedAnnouncements, chineseLevelCount, campusCount, lifeItemCount] =
    await Promise.all([
      prisma.photoSubmission.count({ where: { status: "pending" } }),
      prisma.announcement.count({ where: { isPublished: true } }),
      prisma.chineseLevel.count(),
      prisma.campusSpot.count(),
      prisma.lifeItem.count(),
    ]);

  const upcoming = await prisma.calendarEvent.findMany({
    where: { date: { gte: new Date().toISOString().slice(0, 10) }, isPublished: true },
    orderBy: { date: "asc" },
    take: 3,
    select: CALENDAR_BASE_SELECT, // 不讀 imageUrl：新欄位尚未 db:push 時儀表板也不會壞
  });

  const rows = [
    { emoji: "📷", label: "待審核照片", value: pendingUploads, href: "/admin/images/submissions" },
    { emoji: "📢", label: "已發布公告", value: publishedAnnouncements, href: "/admin/announcements" },
    { emoji: "📚", label: "中文學習關卡", value: chineseLevelCount, href: "/admin/chinese" },
    { emoji: "🏫", label: "校園座標", value: campusCount, href: "/admin/campus" },
    { emoji: "🌏", label: "生活座標", value: lifeItemCount, href: "/admin/life" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">歡迎回到南得遇見你管理後台！</h1>
      <p className="mt-1 text-sm text-ink-400">點擊下面的數字，可以直接進入相對應的管理頁面。</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Link
            key={r.label}
            href={r.href}
            className="rounded-2xl border border-ink-100 dark:border-ink-800 p-5 transition hover:border-transit-400"
          >
            <p className="text-2xl">{r.emoji}</p>
            <p className="mt-3 text-3xl font-bold">{r.value}</p>
            <p className="mt-1 text-sm text-ink-400">{r.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-ink-100 dark:border-ink-800 p-5">
        <h2 className="font-display font-semibold">📅 近期節日</h2>
        {upcoming.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>{e.nameZh}</span>
                <span className="text-ink-400">{e.date}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-400">目前行事曆裡沒有即將到來的節日。</p>
        )}
      </div>
    </div>
  );
}
