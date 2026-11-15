"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import InfoCard, { DecorStyle } from "@/components/InfoCard";
import type { DecorImage, DecorScope } from "@/lib/infoBoxDecor";

const num = "w-20 rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1 text-sm";
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
type Item = DecorImage & { key: string };
const mk = (d: Partial<DecorImage>, i: number): Item => ({ id: "", imageUrl: "", x: 88, y: 12, size: 22, rotate: 0, opacity: 100, mobileScale: 80, mobileVisible: true, visible: true, order: i, ...d, key: d.id || `n${Date.now()}${i}` });

/**
 * 資訊框裝飾圖片編輯器：預覽的就是前台那張資訊框（同一個元件），直接在上面拖曳圖片；位置／大小是相對資訊框的百分比。
 * 圖片永遠在文字下方、不攔截互動，也不會撐高資訊框。手機版有「縮放」與「手機不顯示」。
 */
export default function InfoBoxDecorEditor({ scope, boxId, title, description }: { scope: DecorScope; boxId: string; title: string; description: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Record<string, { l: number; t: number; w: number; h: number }>>({});
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  const snap = (a: Item[]) => JSON.stringify(a.map(({ key: _k, ...r }) => r));
  useEffect(() => {
    fetch(`/api/admin/info-box-images?scope=${scope}&boxId=${encodeURIComponent(boxId)}`)
      .then((r) => r.json())
      .then((j) => {
        const list = ((j.images as DecorImage[]) ?? []).map((d, i) => mk(d, i));
        setItems(list);
        setSaved(snap(list));
        if (j.tableMissing) setTableMissing(true);
      })
      .catch(() => setStatus({ type: "error", text: "讀取裝飾圖片失敗。" }));
  }, [scope, boxId]);
  const dirty = snap(items) !== saved;

  // 量測圖片在預覽中的實際位置（用來疊上拖曳控制框）
  const measure = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    setBoxSize({ w: b.width, h: b.height });
    const out: typeof rects = {};
    el.querySelectorAll<HTMLElement>("[data-decor-id]").forEach((n) => {
      const r = n.getBoundingClientRect();
      out[n.dataset.decorId!] = { l: r.left - b.left, t: r.top - b.top, w: r.width, h: r.height };
    });
    setRects(out);
  }, []);
  useEffect(() => {
    const t = setTimeout(measure, 60);
    const el = boxRef.current;
    const ro = el ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    return () => {
      clearTimeout(t);
      ro?.disconnect();
    };
  }, [items, mobile, measure]);

  const set = (key: string, p: Partial<DecorImage>) => setItems((a) => a.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const idOf = (d: Item) => d.id || d.key; // 新圖片還沒有 id 時用 key 讓預覽能量測
  const drag = useRef<{ key: string; sx: number; sy: number; l: number; t: number; w: number; h: number } | null>(null);
  const cur = items.find((d) => d.key === sel);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const r = await fetch("/api/admin/info-box-images", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, boxId, images: items.map(({ key: _k, ...d }, i) => ({ ...d, order: i })) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "登入已過期，請重新登入管理後台。" : j.error || "儲存失敗。");
      const list = (j.images as DecorImage[]).map((d, i) => mk(d, i));
      setItems(list);
      setSaved(snap(list));
      setStatus({ type: "success", text: "裝飾圖片已儲存，前台已更新。" });
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message });
    }
    setBusy(false);
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[i], a[j]] = [a[j]!, a[i]!];
    setItems(a.map((x, k) => ({ ...x, order: k })));
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-ink-100 p-4 dark:border-ink-800" data-testid="decor-editor">
      <legend className="px-1 text-sm font-semibold">資訊框裝飾圖片（自由定位，不需要固定圖片框）</legend>
      <DecorStyle />
      <StatusBanner status={status} />
      {tableMissing && <p className="rounded bg-lantern-500/10 px-2 py-1 text-xs">「資訊框圖片」資料表尚未建立（請先執行 npm run db:push），目前無法儲存。</p>}
      <p className="text-xs text-ink-400">在下方預覽直接拖曳圖片即可移動；圖片永遠在文字下方，不會遮住文字，也不會讓資訊框變高。手機版可單獨縮放或隱藏。</p>
      <div className="flex gap-2 text-xs">
        <button type="button" data-testid="decor-desktop" onClick={() => setMobile(false)} className={`rounded-full border px-3 py-1 ${!mobile ? "border-transit-500 bg-transit-500 text-white" : "border-ink-100"}`}>桌機預覽</button>
        <button type="button" data-testid="decor-mobile" onClick={() => setMobile(true)} className={`rounded-full border px-3 py-1 ${mobile ? "border-transit-500 bg-transit-500 text-white" : "border-ink-100"}`}>手機預覽</button>
      </div>
      <div className="relative mx-auto" style={{ maxWidth: mobile ? 300 : 380 }} data-force-mobile={mobile ? "1" : undefined}>
        <div ref={boxRef} className="relative" data-testid="decor-preview">
          <InfoCard as="div" title={title || "（標題）"} description={description || "（介紹文字）"} images={items.map((d) => ({ ...d, id: idOf(d) }))} />
        </div>
        {boxSize.w > 0 &&
          items.map((d) => {
            const r = rects[idOf(d)];
            if (!r || !d.visible || (mobile && !d.mobileVisible)) return null;
            return (
              <div
                key={d.key}
                data-testid="decor-handle"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSel(d.key);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  drag.current = { key: d.key, sx: e.clientX, sy: e.clientY, l: r.l, t: r.t, w: r.w, h: r.h };
                }}
                onPointerMove={(e) => {
                  const g = drag.current;
                  if (!g || g.key !== d.key) return;
                  const left = g.l + (e.clientX - g.sx);
                  const top = g.t + (e.clientY - g.sy);
                  const p: Partial<DecorImage> = {};
                  if (boxSize.w - g.w > 0.5) p.x = r1(clamp((left / (boxSize.w - g.w)) * 100, 0, 100));
                  if (boxSize.h - g.h > 0.5) p.y = r1(clamp((top / (boxSize.h - g.h)) * 100, 0, 100));
                  set(d.key, p);
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                className={`absolute z-20 cursor-move touch-none ${sel === d.key ? "border-2 border-lantern-500 bg-lantern-500/10" : "border border-dashed border-ink-300"}`}
                style={{ left: r.l, top: r.t, width: r.w, height: r.h, transform: `rotate(${d.rotate}deg)` }}
              />
            );
          })}
      </div>

      <div className="space-y-2">
        {items.map((d, i) => (
          <div key={d.key} data-testid="decor-row" onClick={() => setSel(d.key)} className={`rounded-lg p-3 ${sel === d.key ? "bg-lantern-500/10" : "bg-ink-50 dark:bg-white/5"}`}>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <ImageUploader label={`圖片 ${i + 1}`} fit="contain" value={d.imageUrl} showRemove={false} onChange={(url) => set(d.key, { imageUrl: url })} />
              <div className="space-y-2 text-xs text-ink-400">
                <div className="flex flex-wrap items-center gap-3">
                  {(
                    [
                      ["X（水平 0–100）", "x", 0, 100],
                      ["Y（垂直 0–100）", "y", 0, 100],
                      ["大小（佔框寬 %）", "size", 3, 80],
                      ["旋轉（度）", "rotate", -180, 180],
                      ["透明度（20–100）", "opacity", 20, 100],
                      ["手機縮放（%）", "mobileScale", 30, 150],
                    ] as [string, keyof DecorImage, number, number][]
                  ).map(([label, k, lo, hi]) => (
                    <label key={k} className="flex flex-col gap-0.5">
                      {label}
                      <input type="number" data-testid={`decor-${k}`} min={lo} max={hi} step={k === "x" || k === "y" || k === "size" ? 0.5 : 1} value={d[k] as number} onChange={(e) => set(d.key, { [k]: clamp(Number(e.target.value), lo, hi) } as Partial<DecorImage>)} className={num} />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={d.visible} onChange={(e) => set(d.key, { visible: e.target.checked })} /> 顯示</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={d.mobileVisible} onChange={(e) => set(d.key, { mobileVisible: e.target.checked })} /> 手機版顯示</label>
                  <span className="ml-auto flex gap-1">
                    <button type="button" aria-label="往後（下層）" onClick={() => move(i, -1)} className="rounded border border-ink-100 p-1"><ArrowUp size={14} /></button>
                    <button type="button" aria-label="往前（上層）" onClick={() => move(i, 1)} className="rounded border border-ink-100 p-1"><ArrowDown size={14} /></button>
                    <button type="button" data-testid="decor-delete" aria-label="刪除這張圖片" onClick={() => setItems((a) => a.filter((x) => x.key !== d.key))} className="rounded border border-red-300 p-1 text-red-500"><Trash2 size={14} /></button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="decor-add" disabled={items.length >= 20} onClick={() => setItems((a) => [...a, mk({ order: a.length }, a.length)])} className="inline-flex items-center gap-1 rounded-lg border border-transit-400 px-3 py-1.5 text-sm text-transit-600">
          <Plus size={14} /> 新增圖片
        </button>
        <button type="button" data-testid="decor-save" disabled={busy || !dirty || tableMissing || items.some((d) => !d.imageUrl)} onClick={save} className="rounded-lg bg-transit-500 px-4 py-1.5 text-sm text-white disabled:opacity-50">
          {busy ? "儲存中…" : "儲存裝飾圖片"}
        </button>
        {dirty && <span className="self-center text-xs text-lantern-600">● 尚未儲存{items.some((d) => !d.imageUrl) ? "（有圖片欄位還沒上傳圖片）" : ""}</span>}
      </div>
      {cur && <p className="text-xs text-ink-400">已選取：圖片 {items.indexOf(cur) + 1}</p>}
    </fieldset>
  );
}
