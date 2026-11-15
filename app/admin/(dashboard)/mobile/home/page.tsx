"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { heroCharacters } from "@/lib/data/heroCharacters";

type CharacterSetting = {
  id: "characterA" | "characterB" | "characterC";
  isVisible: boolean;
  order: number;
  sizeScale: number;
  animationEnabled: boolean;
  animationAmplitude: number;
  animationDuration: number;
};

type HomeSettings = { showQuickLinks: boolean; showIpRow: boolean; showAnnouncements: boolean };

const CHARACTER_LABEL: Record<CharacterSetting["id"], string> = {
  characterA: "角色 A",
  characterB: "角色 B",
  characterC: "角色 C",
};

export default function AdminMobileHomePage() {
  const [home, setHome] = useState<HomeSettings | null>(null);
  const [characters, setCharacters] = useState<CharacterSetting[]>([]);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/mobile-settings")
      .then((res) => res.json())
      .then((data) => {
        setHome(data.home);
        setCharacters(data.characters.sort((a: CharacterSetting, b: CharacterSetting) => a.order - b.order));
      });
  }, []);

  function updateCharacter(id: CharacterSetting["id"], patch: Partial<CharacterSetting>) {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleSave() {
    if (!home) return;
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/admin/mobile-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ home, characters }),
    });
    setSaving(false);
    if (res.ok) {
      setStatus({ type: "success", text: "儲存成功！" });
    } else {
      const data = await res.json();
      setStatus({ type: "error", text: data.error || "儲存失敗，請稍後再試一次。" });
    }
  }

  if (!home) return <p className="text-sm text-ink-400">載入中…</p>;

  const inputClass =
    "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-transit-500";
  const sorted = [...characters].sort((a, b) => a.order - b.order);

  return (
    <div>
      <Link href="/admin/mobile" className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 手機版管理
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold">📱 手機首頁</h1>
      <p className="mt-1 text-sm text-ink-400">
        管理手機版首頁的區塊顯示，以及 3 隻角色在手機版的呈現方式。角色圖片本身維持原本設定，這裡只調整手機版怎麼「擺放」它們。
      </p>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          {/* 手機首頁區塊顯示 */}
          <div className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
            <p className="font-medium">手機首頁區塊顯示</p>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={home.showQuickLinks}
                  onChange={(e) => setHome({ ...home, showQuickLinks: e.target.checked })}
                />
                校園座標／生活座標／中文學習 快速連結
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={home.showIpRow}
                  onChange={(e) => setHome({ ...home, showIpRow: e.target.checked })}
                />
                IP 角色橫向排列區塊
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={home.showAnnouncements}
                  onChange={(e) => setHome({ ...home, showAnnouncements: e.target.checked })}
                />
                重要公告輪播
              </label>
            </div>
          </div>

          {/* 每隻角色設定 */}
          <div className="space-y-4">
            <p className="font-medium">手機首頁 IP 角色設定</p>
            {sorted.map((c) => (
              <div key={c.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{CHARACTER_LABEL[c.id]}</p>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={c.isVisible}
                      onChange={(e) => updateCharacter(c.id, { isVisible: e.target.checked })}
                    />
                    顯示
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs text-ink-400">順序（左→右）</label>
                    <input
                      type="number"
                      value={c.order}
                      onChange={(e) => updateCharacter(c.id, { order: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-400">大小倍率</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2"
                      value={c.sizeScale}
                      onChange={(e) => updateCharacter(c.id, { sizeScale: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-400">浮動幅度 (px)</label>
                    <input
                      type="number"
                      value={c.animationAmplitude}
                      onChange={(e) => updateCharacter(c.id, { animationAmplitude: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-400">浮動週期（秒）</label>
                    <input
                      type="number"
                      step="0.1"
                      value={c.animationDuration}
                      onChange={(e) => updateCharacter(c.id, { animationDuration: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={c.animationEnabled}
                    onChange={(e) => updateCharacter(c.id, { animationEnabled: e.target.checked })}
                  />
                  啟用上下浮動動畫
                </label>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-transit-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-transit-600 disabled:opacity-60"
          >
            {saving ? "儲存中…" : "儲存變更"}
          </button>
        </div>

        {/* 手機預覽 */}
        <div>
          <p className="mb-2 text-sm font-medium">📱 手機預覽</p>
          <div className="mx-auto w-full max-w-[240px] rounded-[2rem] border-4 border-ink-800 dark:border-white/20 bg-canvas-light dark:bg-canvas-dark p-2 shadow-soft">
            <div className="rounded-[1.5rem] overflow-hidden bg-white dark:bg-canvas-darkcard">
              <div className="h-16 bg-transit-500 flex items-center justify-center text-white text-[10px]">首頁 Hero</div>
              {home.showQuickLinks && (
                <div className="flex justify-around gap-1 border-b border-ink-100 dark:border-white/10 px-2 py-3 text-[9px] text-ink-400">
                  <span className="rounded bg-ink-50 dark:bg-white/5 px-2 py-1">校園座標</span>
                  <span className="rounded bg-ink-50 dark:bg-white/5 px-2 py-1">生活座標</span>
                </div>
              )}
              {home.showIpRow && (
                <div className="flex items-end justify-between gap-1 px-4 py-4" style={{ height: 70 }}>
                  {sorted
                    .filter((c) => c.isVisible)
                    .map((c) => (
                      <div key={c.id} style={{ width: `${28 * c.sizeScale}px` }}>
                        <Image
                          src={heroCharacters[c.id].src}
                          alt=""
                          width={heroCharacters[c.id].width}
                          height={heroCharacters[c.id].height}
                          className="h-auto w-full object-contain"
                        />
                      </div>
                    ))}
                </div>
              )}
              {home.showAnnouncements && (
                <div className="mx-2 mb-3 rounded-lg bg-lantern-500/10 px-2 py-2 text-[9px] text-lantern-700 dark:text-lantern-300">
                  📢 重要公告
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-ink-400">示意預覽，非即時網站畫面</p>
        </div>
      </div>
    </div>
  );
}
