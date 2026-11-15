"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MobileOrderList, { MobileOrderItem } from "@/components/admin/MobileOrderList";

export default function MobileCampusPage() {
  const [items, setItems] = useState<MobileOrderItem[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/campus")
      .then((res) => res.json())
      .then((data) =>
        setItems(
          data.spots.map((s: { id: string; nameZh: string; order: number; mobileOrder: number | null; mobileHidden: boolean }) => ({
            id: s.id,
            label: s.nameZh,
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
      <h1 className="mt-2 font-display text-2xl font-bold">📱 手機校園座標</h1>
      <p className="mt-1 text-sm text-ink-400">
        這裡只調整「手機版的排列順序／是否顯示」。要修改標題、介紹等內容文字，請點每一筆的「編輯內容文字」連結——內容跟桌面版是同一份資料。
      </p>
      <div className="mt-6">
        {items ? (
          <MobileOrderList items={items} savePath={(id) => `/api/admin/campus/${id}/mobile`} editHref={(id) => `/admin/campus/${id}/edit`} />
        ) : (
          <p className="text-sm text-ink-400">載入中…</p>
        )}
      </div>
    </div>
  );
}
