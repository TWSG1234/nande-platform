"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CampusForm, { CampusFormValue } from "@/components/admin/CampusForm";

export default function EditCampusPage() {
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<CampusFormValue | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/campus/${params.id}`)
      .then(async (res) => ({ res, data: await res.json().catch(() => ({})) }))
      .then(({ res, data }) => {
        if (res.status === 401) return setLoadError("登入已過期，請重新登入管理後台。");
        if (res.status === 404) return setNotFound(true);
        if (!res.ok || !data.spot) return setLoadError(data.error || "讀取資料失敗，請重新整理頁面。");
        setInitial({
          ...data.spot,
          category: data.spot.category || "culture",
          detailsZh: data.spot.detailsZh || "",
          detailsEn: data.spot.detailsEn || "",
          mainResponsibilityZh: data.spot.mainResponsibilityZh || "",
          mainResponsibilityEn: data.spot.mainResponsibilityEn || "",
        });
      })
      .catch(() => setLoadError("無法連到伺服器，請確認網站是否正在執行。"));
  }, [params.id]);

  async function handleSubmit(value: CampusFormValue) {
    const res = await fetch(`/api/admin/campus/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: res.status === 401 ? "登入已過期，請重新登入後再儲存。" : data.error || "儲存失敗，請稍後再試一次。" };
    return { ok: true };
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (notFound) return <p className="text-sm text-ink-400">找不到這筆資料。</p>;
  if (!initial) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">編輯｜{initial.nameZh}</h1>
      <div className="mt-6">
        <CampusForm initial={initial} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
