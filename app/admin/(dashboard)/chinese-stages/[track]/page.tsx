"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";

type Stage = {
  id: string;
  track: string;
  levelNumber: number;
  titleZh: string;
  titleEn: string;
  order: number;
  isPublished: boolean;
};

export default function AdminChineseTrackPage({ params }: { params: { track: string } }) {
  const track = params.track === "campus" ? "campus" : "life";
  const trackLabel = track === "life" ? "生活" : "校園";

  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/chinese-stages?track=${track}`);
    const data = await res.json();
    if (res.ok) setStages(data.stages);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  async function addStage() {
    const nextLevel = stages.length > 0 ? Math.max(...stages.map((s) => s.levelNumber)) + 1 : 1;
    const res = await fetch("/api/admin/chinese-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track, levelNumber: nextLevel, order: nextLevel }),
    });
    if (res.ok) {
      setStatus({ type: "success", text: `已新增第 ${nextLevel} 關！` });
      load();
    } else {
      setStatus({ type: "error", text: "新增失敗，請稍後再試一次。" });
    }
  }

  async function updateStage(id: string, data: Partial<Stage>) {
    await fetch(`/api/admin/chinese-stages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    load();
  }

  async function move(stage: Stage, direction: -1 | 1) {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === stage.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      updateStage(stage.id, { order: swapWith.order }),
      updateStage(swapWith.id, { order: stage.order }),
    ]);
  }

  async function removeStage(id: string) {
    if (!confirm("確定要刪除這個關卡嗎？裡面所有學習頁、單字、題目都會一起刪除，無法復原。")) return;
    const res = await fetch(`/api/admin/chinese-stages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus({ type: "success", text: "刪除成功！" });
      load();
    } else {
      setStatus({ type: "error", text: "刪除失敗，請稍後再試一次。" });
    }
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order);

  return (
    <div>
      <Link href="/admin/chinese-stages" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-transit-500">
        <ArrowLeft size={13} /> 中文學習
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">中文學習 · {trackLabel}</h1>
        <button
          onClick={addStage}
          className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-transit-600"
        >
          <Plus size={16} /> 新增關卡
        </button>
      </div>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-400">載入中…</p>
      ) : sorted.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-ink-100 dark:border-ink-800 p-6 text-center text-sm text-ink-400">
          還沒有關卡，點「新增關卡」開始吧。
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {sorted.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
              <div className="flex flex-col">
                <button onClick={() => move(s, -1)} disabled={i === 0} className="p-1 text-ink-400 disabled:opacity-20">
                  <ArrowUp size={14} />
                </button>
                <button onClick={() => move(s, 1)} disabled={i === sorted.length - 1} className="p-1 text-ink-400 disabled:opacity-20">
                  <ArrowDown size={14} />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-400">第 {s.levelNumber} 關</p>
                <input
                  value={s.titleZh}
                  onChange={(e) => setStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, titleZh: e.target.value } : x)))}
                  onBlur={(e) => updateStage(s.id, { titleZh: e.target.value })}
                  data-testid="stage-title-zh"
                  placeholder={`中文名稱（留空顯示「第 ${s.levelNumber} 關」）`}
                  className="mt-0.5 w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1 text-sm outline-none focus:border-transit-500"
                />
                <input
                  value={s.titleEn}
                  data-testid="stage-title-en"
                  onChange={(e) => setStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, titleEn: e.target.value } : x)))}
                  onBlur={(e) => updateStage(s.id, { titleEn: e.target.value })}
                  placeholder={`英文名稱（留空顯示 Level ${s.levelNumber}，不會用中文代替）`}
                  className="mt-1 w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1 text-sm outline-none focus:border-transit-500"
                />
              </div>

              <button
                onClick={() => updateStage(s.id, { isPublished: !s.isPublished })}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                  s.isPublished ? "bg-green-500/10 text-green-600 dark:text-green-300" : "bg-ink-100 dark:bg-white/10 text-ink-400"
                }`}
              >
                {s.isPublished ? "已發布" : "草稿"}
              </button>

              <Link
                href={`/admin/chinese-stages/${track}/${s.id}`}
                className="shrink-0 rounded-lg bg-ink-100 dark:bg-white/10 px-3 py-1.5 text-xs font-medium"
              >
                編輯內容
              </Link>

              <button onClick={() => removeStage(s.id)} className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-500/10">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
