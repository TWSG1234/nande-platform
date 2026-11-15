import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MobileNavPage() {
  return (
    <div>
      <Link href="/admin/mobile" className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 手機版管理
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">📱 手機導覽列</h1>

      <div className="mt-6 rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6">
        <p className="text-sm text-ink-600 dark:text-ink-100">
          目前導覽列（桌面版與手機版共用同一份）的項目與順序是寫在程式碼裡的（<code>components/Navbar.tsx</code>），還沒有做成後台可以調整的資料表。「關於我們」目前規定永遠是最後一個項目。
        </p>
        <p className="mt-3 text-xs text-ink-400">
          老實說明：這裡還沒有可以操作的設定——如果你需要「手機版導覽列順序跟桌面版不同」或「後台可以調整導覽項目」，這是還沒做的功能，可以請我下一輪繼續處理。
        </p>
      </div>
    </div>
  );
}
