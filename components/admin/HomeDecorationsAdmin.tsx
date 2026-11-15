"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { Decoration, DeviceSettings } from "@/lib/home/decorations";

type Device = "desktop" | "mobile";
const FRAME_W: Record<Device, number> = { desktop: 1280, mobile: 390 };
const inputCls = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500";
const btn = "rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-1.5 text-sm transition hover:border-transit-400 disabled:opacity-50";
const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type HeroRect = { x: number; y: number; w: number; h: number; docH: number };

/**
 * 預覽＝真正的首頁（iframe 載入 /?decorPreview=1，桌面 1280px、手機 390px 寬，所以版面、標題、搜尋框、按鈕、IP 角色都是真的），
 * 草稿裝飾用 postMessage 傳進去顯示，不需要先儲存。iframe 本身不可操作（pointer-events:none），
 * 拖曳只發生在上面的「控制框」，只會改變裝飾的 X、Y，不會碰到首頁原有內容。
 */
function HeroPreview({
  device,
  items,
  selectedId,
  onSelect,
  onMove,
}: {
  device: Device;
  items: Decoration[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, patch: Partial<DeviceSettings>) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [cw, setCw] = useState(0);
  const [hero, setHero] = useState<HeroRect | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const W = FRAME_W[device];
  const scale = cw > 0 ? cw / W : 0;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "nande-decor-set", items: itemsRef.current }, window.location.origin);
  }, []);
  useEffect(() => {
    send();
  }, [items, send]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { type?: string } & Partial<HeroRect>;
      if (d?.type === "nande-decor-ready") send();
      if (d?.type === "nande-decor-hero" && typeof d.w === "number" && typeof d.h === "number") setHero({ x: d.x ?? 0, y: d.y ?? 0, w: d.w, h: d.h, docH: d.docH ?? 0 });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [send]);

  const frameH = hero ? Math.min(hero.y + hero.h + 24, hero.docH || 4000) : 640;
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  return (
    <div className={device === "mobile" ? "mx-auto w-[300px] max-w-full" : "w-full"}>
      <p className="mb-1 text-center text-xs text-ink-400">{device === "mobile" ? "手機版（寬 390px）" : "桌面版（寬 1280px）"}｜在預覽上拖曳虛線框即可移動裝飾</p>
      <div ref={boxRef} className="relative overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800 bg-canvas-light" style={{ height: scale ? frameH * scale : 200 }}>
        <iframe
          ref={frameRef}
          title={`${device} preview`}
          src="/?decorPreview=1"
          onLoad={() => {
            setLoadFailed(false);
            send();
          }}
          onError={() => setLoadFailed(true)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
          style={{ width: W, height: frameH, transform: `scale(${scale || 1})`, transformOrigin: "top left" }}
        />
        {loadFailed && <p className="absolute inset-0 flex items-center justify-center text-xs text-red-500">預覽載入失敗，請重新整理頁面。</p>}
        {hero && scale > 0 && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute border border-dashed border-white/60" style={{ left: hero.x * scale, top: hero.y * scale, width: hero.w * scale, height: hero.h * scale }} />
            {items
              .filter((d) => d.isVisible && d.area === "hero" && d.imageUrl && d[device].visible)
              .map((d) => {
                const s = d[device];
                const w = (s.size / 100) * hero.w * scale;
                const h = d.naturalWidth && d.naturalHeight ? (w * d.naturalHeight) / d.naturalWidth : w;
                const sel = d.id === selectedId;
                return (
                  <div
                    key={d.id}
                    data-testid="decor-handle"
                    title={`${d.name}（拖曳移動）`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect(d.id);
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      drag.current = { id: d.id, sx: e.clientX, sy: e.clientY, ox: s.x, oy: s.y };
                    }}
                    onPointerMove={(e) => {
                      const g = drag.current;
                      if (!g || g.id !== d.id) return;
                      const dx = ((e.clientX - g.sx) / scale / hero.w) * 100;
                      const dy = ((e.clientY - g.sy) / scale / hero.h) * 100;
                      onMove(d.id, { x: Math.round(clampN(g.ox + dx, -50, 150) * 10) / 10, y: Math.round(clampN(g.oy + dy, -50, 150) * 10) / 10 });
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    className={`pointer-events-auto absolute cursor-move touch-none ${sel ? "border-2 border-solid border-lantern-500 bg-lantern-500/10" : "border border-dashed border-white/80"}`}
                    style={{ left: (hero.x + (s.x / 100) * hero.w) * scale, top: (hero.y + (s.y / 100) * hero.h) * scale, width: w, height: h, transform: `translate(-50%,-50%) rotate(${s.rotate}deg)` }}
                  />
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceForm({ label, value, onChange }: { label: string; value: DeviceSettings; onChange: (v: DeviceSettings) => void }) {
  const num = (k: keyof DeviceSettings, min: number, max: number, step = 1) => (
    <input type="number" min={min} max={max} step={step} value={value[k] as number} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} className={inputCls} />
  );
  return (
    <fieldset className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={value.visible} onChange={(e) => onChange({ ...value, visible: e.target.checked })} /> 在{label}顯示
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-400">
        <label>X 位置（中心點，%）{num("x", -50, 150, 0.5)}</label>
        <label>Y 位置（中心點，%）{num("y", -50, 150, 0.5)}</label>
        <label>圖片寬度（佔主視覺寬度 %）{num("size", 1, 150, 0.5)}</label>
        <label>旋轉角度（度）{num("rotate", -180, 180)}</label>
        <label className="col-span-2">不透明度 %{num("opacity", 5, 100)}</label>
      </div>
    </fieldset>
  );
}

export default function HomeDecorationsAdmin() {
  const [items, setItems] = useState<Decoration[] | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const newFile = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/admin/home-decorations", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "讀取失敗");
      setItems(j.items);
      setDirty({});
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message || "讀取失敗，請重新整理頁面。" });
    }
  }
  useEffect(() => {
    load();
  }, []);

  const patch = (id: string, p: Partial<Decoration>) => {
    setItems((list) => (list ? list.map((d) => (d.id === id ? { ...d, ...p } : d)) : list));
    setDirty((d) => ({ ...d, [id]: true }));
  };
  const patchDevice = (id: string, device: Device, p: Partial<DeviceSettings>) =>
    setItems((list) => {
      if (!list) return list;
      return list.map((d) => (d.id === id ? { ...d, [device]: { ...d[device], ...p } } : d));
    });
  const moveDrag = (device: Device) => (id: string, p: Partial<DeviceSettings>) => {
    patchDevice(id, device, p);
    setDirty((d) => ({ ...d, [id]: true }));
  };

  async function call(key: string, fn: () => Promise<Response>, ok: string) {
    setBusy(key);
    setStatus(null);
    try {
      const r = await fn();
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "操作失敗，請稍後再試。");
      setStatus({ type: "success", text: ok });
      await load();
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const add = () => {
    const f = newFile.current?.files?.[0];
    if (!f) return setStatus({ type: "error", text: "請先選擇一張透明底 PNG。" });
    const fd = new FormData();
    fd.append("file", f);
    fd.append("name", newName);
    fd.append("area", "hero");
    call("new", () => fetch("/api/admin/home-decorations", { method: "POST", body: fd }), "已新增並套用到前台首頁！可以在預覽上拖曳調整位置。").then(() => {
      if (newFile.current) newFile.current.value = "";
      setNewName("");
    });
  };

  const save = (d: Decoration) =>
    call(d.id, () => fetch(`/api/admin/home-decorations/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: d.name, isVisible: d.isVisible, desktop: d.desktop, mobile: d.mobile }) }), "已儲存，前台首頁立即套用！");

  const saveAll = async () => {
    if (!items) return;
    const ds = items.filter((d) => dirty[d.id]);
    if (!ds.length) return setStatus({ type: "success", text: "沒有需要儲存的變更。" });
    setBusy("all");
    setStatus(null);
    try {
      for (const d of ds) {
        const r = await fetch(`/api/admin/home-decorations/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: d.name, isVisible: d.isVisible, desktop: d.desktop, mobile: d.mobile }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "儲存失敗");
      }
      setStatus({ type: "success", text: `已儲存 ${ds.length} 張裝飾，前台首頁立即套用！` });
      await load();
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const replace = (d: Decoration, f: File | undefined) => {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    call(d.id, () => fetch(`/api/admin/home-decorations/${d.id}`, { method: "PUT", body: fd }), "已更換圖片並套用（舊圖已移到 uploads\\_trash）。");
  };

  const remove = (d: Decoration) => {
    if (!window.confirm(`確定要刪除這張裝飾「${d.name}」嗎？\n圖片會從首頁移除（檔案移到 uploads\\_trash，可找回），其他裝飾不受影響。`)) return;
    call(d.id, () => fetch(`/api/admin/home-decorations/${d.id}`, { method: "DELETE" }), "已刪除這張裝飾。");
  };

  // 圖層前後：清單由上到下＝由前到後（最上面那張畫在最前面）；全部都在首頁文字／按鈕／IP 的下方
  const sorted = items ? [...items].sort((a, b) => b.sortOrder - a.sortOrder) : [];
  const layer = (d: Decoration, dir: -1 | 1) => {
    const i = sorted.findIndex((x) => x.id === d.id);
    const other = sorted[i + dir];
    if (!other) return;
    call(
      d.id,
      async () => {
        const tmp = other.sortOrder === d.sortOrder ? d.sortOrder + (dir === -1 ? 1 : -1) : other.sortOrder;
        const a = await fetch(`/api/admin/home-decorations/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: Math.max(0, tmp) }) });
        if (!a.ok) return a;
        return fetch(`/api/admin/home-decorations/${other.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: d.sortOrder }) });
      },
      "已調整圖層順序。",
    );
  };

  const anyDirty = Object.values(dirty).some(Boolean);

  return (
    <section className="mt-10 border-t border-ink-100 dark:border-ink-800 pt-8" data-testid="home-decorations-admin">
      <h2 className="font-display text-xl font-bold">首頁主視覺裝飾</h2>
      <p className="mt-1 text-sm text-ink-400">
        裝飾範圍是首頁導覽列下方「整個藍色主視覺區域」（標題、介紹、搜尋框、按鈕、IP 角色與周圍留白）。可以上傳多張透明背景 PNG，自由指定位置、大小與角度，甚至延伸到區域邊緣（超出的部分會被裁切，不會出現橫向捲軸）。
      </p>
      <p className="mt-2 text-sm text-ink-400">
        圖層固定為：<b>主視覺底色 → 裝飾圖樣 → 標題、介紹、搜尋框、按鈕、IP 角色</b>。裝飾可以疊在文字或角色的背後，但永遠畫在它們的下方、不會擋住點擊。
      </p>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-ink-400">
        <li>選擇透明底 PNG（不透明的圖、JPG、GIF、SVG、MP4 會被拒絕；PNG 最大 2 MB、單邊最多 4096 像素、不支援交錯式 PNG）。</li>
        <li>按「新增」後，在下方預覽用滑鼠（或手指）拖曳虛線框移動位置；也可以在每張圖的欄位直接輸入 X、Y、寬度、角度。桌面版與手機版分開設定。</li>
        <li>調整完按「儲存」，前台首頁立即套用。想拿掉就按「刪除這張裝飾」。</li>
      </ol>
      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      <div className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
        <h3 className="font-medium">新增裝飾</h3>
        <label className="mt-2 block text-xs text-ink-400">
          名稱（方便辨識，可留空）
          <input value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
        </label>
        <input ref={newFile} type="file" accept=".png,image/png" disabled={busy === "new"} className="mt-2 block w-full text-sm" />
        <button type="button" disabled={busy === "new"} onClick={add} className={`${btn} mt-3`}>
          {busy === "new" ? "檢查並上傳中…" : "新增"}
        </button>
      </div>

      {items && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">真實首頁預覽（尚未儲存的調整也會即時顯示）</h3>
            <button type="button" disabled={!anyDirty || busy === "all"} onClick={saveAll} className={`${btn} bg-transit-500 text-white hover:bg-transit-600`}>
              {busy === "all" ? "儲存中…" : anyDirty ? "儲存全部變更" : "沒有未儲存的變更"}
            </button>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_300px] xl:items-start">
            <HeroPreview device="desktop" items={sorted.slice().reverse()} selectedId={selected} onSelect={setSelected} onMove={moveDrag("desktop")} />
            <HeroPreview device="mobile" items={sorted.slice().reverse()} selectedId={selected} onSelect={setSelected} onMove={moveDrag("mobile")} />
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {!items ? (
          <p className="text-sm text-ink-400">讀取中…</p>
        ) : sorted.length === 0 ? (
          <p className="rounded-lg bg-ink-50 dark:bg-white/5 px-3 py-2 text-sm text-ink-500">還沒有裝飾圖樣。</p>
        ) : (
          <>
            <p className="text-xs text-ink-400">清單由上到下＝圖層由前到後（最上面那張畫在其他裝飾之上）。</p>
            {sorted.map((d, i) => (
              <div key={d.id} onClick={() => setSelected(d.id)} className={`rounded-xl border p-4 ${selected === d.id ? "border-lantern-500" : "border-ink-100 dark:border-ink-800"}`} data-testid="decoration-card">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[conic-gradient(#ddd_25%,#fff_0_50%,#ddd_0_75%,#fff_0)] bg-[length:12px_12px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.imageUrl} alt={d.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="text-xs text-ink-400">
                      圖樣名稱
                      <input value={d.name} maxLength={40} onChange={(e) => patch(d.id, { name: e.target.value })} className={inputCls} />
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={d.isVisible} onChange={(e) => patch(d.id, { isVisible: e.target.checked })} /> 顯示（取消＝暫時隱藏；要完全移除請按「刪除這張裝飾」）
                    </label>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <DeviceForm label="桌面版" value={d.desktop} onChange={(v) => { patchDevice(d.id, "desktop", v); setDirty((x) => ({ ...x, [d.id]: true })); }} />
                  <DeviceForm label="手機版" value={d.mobile} onChange={(v) => { patchDevice(d.id, "mobile", v); setDirty((x) => ({ ...x, [d.id]: true })); }} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy === d.id} onClick={() => save(d)} className={`${btn} bg-transit-500 text-white hover:bg-transit-600`}>
                    {busy === d.id ? "處理中…" : "儲存"}
                  </button>
                  <label className={`${btn} cursor-pointer`}>
                    更換圖片
                    <input type="file" accept=".png,image/png" className="hidden" onChange={(e) => { replace(d, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  <button type="button" disabled={i === 0 || !!busy} onClick={() => layer(d, -1)} className={btn}>往前一層</button>
                  <button type="button" disabled={i === sorted.length - 1 || !!busy} onClick={() => layer(d, 1)} className={btn}>往後一層</button>
                  <button type="button" disabled={!!busy} onClick={() => remove(d)} className={`${btn} text-red-500`}>刪除這張裝飾</button>
                  {dirty[d.id] && <span className="text-xs text-lantern-600">尚未儲存</span>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
