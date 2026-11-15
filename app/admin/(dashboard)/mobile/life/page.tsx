"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MobileOrderList, { MobileOrderItem } from "@/components/admin/MobileOrderList";

export default function MobileLifePage() {
  const [items, setItems] = useState<MobileOrderItem[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/life-items")
      .then((res) => res.json())
      .then((data) =>
        setItems(
          data.items.map((s: { id: string; titleZh: string; order: number; mobileOrder: number | null; mobileHidden: boolean }) => ({
            id: s.id,
            label: s.titleZh,
            desktopOrder: s.order,
            mobileOrder: s.mobileOrder,
            mobileHidden: s.mobileHidden,
          }))
        )
      );
  }, []);

  return (
    <div>
      <Link href="/admin/mobile" className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 手機版管理
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">📱 手機生活座標</h1>
      <p className="mt-1 text-sm text-ink-400">
        這裡只調整「手機版的排列順序／是否顯示」（涵蓋用餐禮儀／交通／消費）。要修改標題、說明文字，請點「編輯內容文字」——內容跟桌面版是同一份資料。
      </p>
      <div className="mt-6">
        {items ? (
          <MobileOrderList items={items} savePath={(id) => `/api/admin/life-items/${id}/mobile`} editHref={(id) => `/admin/life/${id}/edit`} />
        ) : (
          <p className="text-sm text-ink-400">載入中…</p>
        )}
      </div>
    </div>
  );
}
