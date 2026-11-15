import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function MobileSectionStub({
  title,
  editHref,
  editLabel,
}: {
  title: string;
  editHref: string;
  editLabel: string;
}) {
  return (
    <div>
      <Link href="/admin/mobile" className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 手機版管理
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">{title}</h1>

      <div className="mt-6 rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6">
        <p className="text-sm text-ink-600 dark:text-ink-100">
          這個區塊的內容跟桌面版是同一份資料，編輯內容文字請到現有的管理頁面：
        </p>
        <Link
          href={editHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600"
        >
          {editLabel} <ExternalLink size={14} />
        </Link>
        <p className="mt-4 text-xs text-ink-400">
          老實說明：這個區塊「手機專屬的排列順序／顯示設定」目前還沒有建立（跟已經做好的「手機首頁」「手機校園座標」「手機生活座標」不一樣），手機版目前會照桌面版的順序與顯示狀態呈現。如果需要，可以請我比照校園座標/生活座標的做法繼續補上。
        </p>
      </div>
    </div>
  );
}
