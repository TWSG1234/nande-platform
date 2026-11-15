import Link from "next/link";
import { Coffee, GraduationCap } from "lucide-react";

export default function AdminChineseStagesHubPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">中文學習（生活／校園）</h1>
      <p className="mt-1 text-sm text-ink-400">
        這裡管理的是「中文學習」區裡的「生活」／「校園」兩個分區——跟網站的「生活座標」「校園座標」是完全不同的兩套內容，請不要搞混。
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-xl">
        <Link
          href="/admin/chinese-stages/life"
          className="flex flex-col items-center gap-3 rounded-2xl border border-ink-100 dark:border-ink-800 p-8 text-center transition hover:border-transit-400"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-transit-500/10 text-transit-600 dark:text-transit-300">
            <Coffee size={28} />
          </span>
          <p className="font-display text-xl font-bold">生活</p>
        </Link>
        <Link
          href="/admin/chinese-stages/campus"
          className="flex flex-col items-center gap-3 rounded-2xl border border-ink-100 dark:border-ink-800 p-8 text-center transition hover:border-transit-400"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-transit-500/10 text-transit-600 dark:text-transit-300">
            <GraduationCap size={28} />
          </span>
          <p className="font-display text-xl font-bold">校園</p>
        </Link>
      </div>
      <p className="mt-4 max-w-xl text-xs text-ink-400">「答題成功動畫」請進入各個關卡的編輯頁設定——每一關都有自己獨立的動畫。</p>
    </div>
  );
}
