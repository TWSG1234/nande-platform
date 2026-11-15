"use client";

import { useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import HomeDecorationsAdmin from "@/components/admin/HomeDecorationsAdmin";
import ImageUploader from "@/components/admin/ImageUploader";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Appearance = {
  siteNameZh: string;
  siteNameEn: string;
  heroTitleZh: string;
  heroTitleEn: string;
  subtitleZh: string;
  subtitleEn: string;
  popularTitleZh: string;
  popularTitleEn: string;
  popularSubtitleZh: string;
  popularSubtitleEn: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  cardColor: string;
  buttonColor: string;
  navbarColor: string;
  footerColor: string;
  logoUrl: string | null;
  homeHeroUrl: string | null;
  homeBackgroundUrl: string | null;
  homeDecorationUrl: string | null;
  ipCharacter1Url: string | null;
  ipCharacter2Url: string | null;
  ipCharacter3Url: string | null;
  footerText: string;
};

const COLOR_FIELDS: { key: keyof Appearance; label: string; wired: boolean }[] = [
  { key: "primaryColor", label: "主色", wired: true },
  { key: "secondaryColor", label: "輔助色", wired: true },
  { key: "backgroundColor", label: "背景色", wired: true },
  { key: "textColor", label: "文字色", wired: true },
  { key: "cardColor", label: "卡片背景色", wired: true },
  { key: "buttonColor", label: "特別註釋文字顏色（小標籤/eyebrow 文字）", wired: true },
  { key: "navbarColor", label: "導覽列色", wired: true },
  { key: "footerColor", label: "頁尾色", wired: true },
];

const IMAGE_FIELDS: { key: keyof Appearance; label: string }[] = [
  { key: "logoUrl", label: "網站 Logo" },
  { key: "homeHeroUrl", label: "首頁主視覺" },
  { key: "homeBackgroundUrl", label: "首頁背景" },
  { key: "homeDecorationUrl", label: "首頁裝飾圖" },
  { key: "ipCharacter1Url", label: "IP角色 1" },
  { key: "ipCharacter2Url", label: "IP角色 2" },
  { key: "ipCharacter3Url", label: "IP角色 3" },
];

export default function AdminAppearancePage() {
  const [value, setValue] = useState<Appearance | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    fetch("/api/admin/appearance")
      .then((res) => res.json())
      .then((data) => setValue(data.settings));
  }, []);

  async function handleSave() {
    if (!value) return;
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/admin/appearance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    setSaving(false);
    if (res.ok) {
      setStatus({ type: "success", text: "儲存成功！重新整理前台頁面即可看到套用後的顏色。" });
    } else {
      const data = await res.json();
      setStatus({ type: "error", text: data.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  if (!value) return <p className="text-sm text-ink-400">載入中…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">🎨 網站外觀</h1>
      <p className="mt-1 text-sm text-ink-400">
        「主色／輔助色／背景色／文字色／卡片背景色／導覽列色／頁尾色／特別註釋文字顏色」儲存後全站立即套用（重新整理頁面即可看到）。按鈕沒有獨立顏色設定——依照按鈕的層級自動使用主色或輔助色，跟著上面兩色一起變。
      </p>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <div>
            <p className="mb-3 font-medium">網站名稱</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-ink-400">中文名稱</label>
                <input
                  value={value.siteNameZh}
                  onChange={(e) => setValue({ ...value, siteNameZh: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-400">English Name</label>
                <input
                  value={value.siteNameEn}
                  onChange={(e) => setValue({ ...value, siteNameEn: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              會顯示在導覽列、頁尾、瀏覽器頁籤標題、管理後台側邊欄——改這裡，全站都會一起變。
            </p>
          </div>

          <div>
            <p className="mb-3 font-medium">首頁文字</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-ink-400">首頁主標題（中文，留空使用預設文字）</label>
                  <input
                    value={value.heroTitleZh}
                    onChange={(e) => setValue({ ...value, heroTitleZh: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-400">Homepage Title (English)</label>
                  <input
                    value={value.heroTitleEn}
                    onChange={(e) => setValue({ ...value, heroTitleEn: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-ink-400">首頁副標題（中文，留空使用預設文字）</label>
                  <textarea
                    rows={2}
                    value={value.subtitleZh}
                    onChange={(e) => setValue({ ...value, subtitleZh: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-400">Homepage Subtitle (English)</label>
                  <textarea
                    rows={2}
                    value={value.subtitleEn}
                    onChange={(e) => setValue({ ...value, subtitleEn: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-ink-400">「熱門 × 行事曆」區塊標題（中文，留空使用預設文字）</label>
                  <input
                    value={value.popularTitleZh}
                    onChange={(e) => setValue({ ...value, popularTitleZh: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-400">Section Title (English)</label>
                  <input
                    value={value.popularTitleEn}
                    onChange={(e) => setValue({ ...value, popularTitleEn: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-ink-400">該區塊說明文字（中文，留空使用預設文字）</label>
                  <input
                    value={value.popularSubtitleZh}
                    onChange={(e) => setValue({ ...value, popularSubtitleZh: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-400">Section Subtitle (English)</label>
                  <input
                    value={value.popularSubtitleEn}
                    onChange={(e) => setValue({ ...value, popularSubtitleEn: e.target.value })}
                    className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-400">
              老實說明：目前首頁可以從這裡管理的文字是主標題、副標題、跟「熱門 ×
              行事曆」區塊標題/說明——校園座標／生活座標／中文學習這三張快速連結卡片的文字，目前還是寫在程式的多語系字典裡，還沒有做成後台可編輯，如果需要我可以下一輪繼續補上。
            </p>
          </div>

          <div>
            <p className="mb-3 font-medium">顏色設定</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {COLOR_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                    {f.label}
                    {!f.wired && <span className="rounded-full bg-ink-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] text-ink-400">尚未接上前台</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value[f.key] as string}
                      onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded border border-ink-100 dark:border-ink-800 bg-transparent"
                    />
                    <input
                      value={value[f.key] as string}
                      onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
                      className="w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 font-medium">圖片設定</p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {IMAGE_FIELDS.map((f) => (
                <ImageUploader
                  key={f.key}
                  label={f.label}
                  value={value[f.key] as string | null}
                  onChange={(url) => setValue({ ...value, [f.key]: url })}
                  {...(f.key === "logoUrl"
                    ? {
                        removeLabel: "移除自訂 Logo（改用內建 Logo）",
                        removeConfirm: "確定要移除自訂 Logo 嗎？\n網站不能沒有 Logo，移除後導覽列與頁尾會改用內建的預設 Logo。",
                        removedNote: "已移除自訂 Logo。請按「儲存設定」，前台就會改用內建 Logo。",
                      }
                    : { removedNote: "已刪除圖片。請按「儲存設定」，才會真的清空。" })}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-400">
              目前只有「網站 Logo」已經接上前台導覽列；其餘圖片欄位已經可以上傳與儲存，套用到各頁面的部分尚未完成。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">頁尾文字（選填）</label>
            <input
              value={value.footerText}
              onChange={(e) => setValue({ ...value, footerText: e.target.value })}
              className="w-full max-w-md rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60"
          >
            {saving ? "儲存中…" : "儲存設定"}
          </button>
        </div>

        {/* 即時預覽——用目前表單上的顏色（還沒儲存也看得到），示意桌面/手機版導覽列、
            按鈕、卡片套用後的樣子。不是真的網站畫面，但顏色是即時反映的。 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => setPreviewMode("desktop")}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs ${previewMode === "desktop" ? "bg-transit-500 text-white" : "border border-ink-100 dark:border-ink-800 text-ink-400"}`}
            >
              <Monitor size={12} /> 桌面
            </button>
            <button
              onClick={() => setPreviewMode("mobile")}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs ${previewMode === "mobile" ? "bg-transit-500 text-white" : "border border-ink-100 dark:border-ink-800 text-ink-400"}`}
            >
              <Smartphone size={12} /> 手機
            </button>
          </div>

          <div
            className={`overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800 ${previewMode === "mobile" ? "mx-auto max-w-[240px]" : "w-full"}`}
            style={{ backgroundColor: value.backgroundColor }}
          >
            <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: value.navbarColor }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {value.logoUrl ? <img src={value.logoUrl} alt="" className="h-5" /> : <span style={{ color: value.textColor }} className="text-xs font-bold">南得遇見你</span>}
              <span style={{ color: value.textColor }} className="text-[9px] opacity-60">中 EN</span>
            </div>
            <div className="p-4">
              <span style={{ color: value.buttonColor }} className="text-[9px] font-semibold uppercase tracking-wide">
                ● Section Label
              </span>
              <p style={{ color: value.textColor }} className="mt-1 text-sm font-bold">歡迎來到台灣</p>
              <p style={{ color: value.textColor }} className="mt-1 text-[10px] opacity-70">一起把陌生變熟悉</p>
              <button style={{ backgroundColor: value.primaryColor }} className="mt-3 rounded-full px-3 py-1.5 text-[10px] font-medium text-white">
                瀏覽生活座標
              </button>
              <div style={{ backgroundColor: value.cardColor }} className="mt-4 rounded-lg border border-black/5 p-2 shadow-sm">
                <p style={{ color: value.primaryColor }} className="text-[10px] font-semibold">校園座標</p>
                <p style={{ color: value.textColor }} className="mt-0.5 text-[9px] opacity-60">行政單位、宿舍、餐廳…</p>
              </div>
              <span style={{ backgroundColor: value.secondaryColor }} className="mt-3 inline-block rounded-full px-2 py-0.5 text-[9px] text-white">
                📢 公告
              </span>
            </div>
            <div className="px-3 py-2 text-center text-[9px] border-t border-black/5" style={{ backgroundColor: value.footerColor, color: value.textColor }}>
              {value.footerText || "© 南得遇見你"}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-ink-400">示意預覽，非真正網站畫面</p>
        </div>
      </div>

      <HomeDecorationsAdmin />
    </div>
  );
}
