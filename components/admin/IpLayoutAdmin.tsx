"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import ImageUploader from "@/components/admin/ImageUploader";
import {
  IP_CHAR_IDS,
  IP_CHAR_NAMES,
  IP_DEVICES,
  IpCharId,
  IpDevice,
  IpDeviceSettings,
  IpLayouts,
  IpSavedFlags,
  MAX_PX,
  MIN_PX,
  sanitizeIpDevice,
} from "@/lib/home/ipLayout";

const DEVICE_LABEL: Record<IpDevice, string> = { desktop: "🖥️ 桌機版", tablet: "📱 平板版", mobile: "📲 手機版" };
const DEVICE_RANGE: Record<IpDevice, string> = { desktop: "寬度 1024px 以上", tablet: "寬度 640～1023px", mobile: "寬度 639px 以下" };
/** 預設預覽尺寸＋其他常見尺寸（預覽用的是真正的首頁，換寬度就是換成那個寬度的實際畫面） */
const PREVIEW_WIDTHS: Record<IpDevice, { w: number; h: number; label: string }[]> = {
  desktop: [
    { w: 1440, h: 900, label: "1440 × 900（預設）" },
    { w: 1024, h: 768, label: "1024 × 768（平板橫向）" },
    { w: 1280, h: 800, label: "1280 × 800" },
    { w: 1920, h: 1080, label: "1920 × 1080" },
  ],
  tablet: [
    { w: 768, h: 1024, label: "768 × 1024（預設，直向）" },
    { w: 640, h: 960, label: "640 × 960（平板最窄）" },
    { w: 820, h: 1180, label: "820 × 1180" },
    { w: 1000, h: 700, label: "1000 × 700（橫向小平板）" },
  ],
  mobile: [
    { w: 390, h: 844, label: "390 × 844（預設）" },
    { w: 360, h: 800, label: "360 × 800（較窄手機）" },
    { w: 430, h: 932, label: "430 × 932" },
  ],
};
const inputCls = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500";
const btn = "rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-1.5 text-sm transition hover:border-transit-400 disabled:opacity-50";
const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

type Snapshot = {
  layouts: IpLayouts;
  saved: IpSavedFlags;
  tableReady: boolean;
  defaults: IpLayouts;
  images: Record<IpCharId, { src: string; width: number; height: number; custom: boolean }>;
};
type Fig = { left: number; top: number; w: number; h: number; hidden: boolean };
type Hero = { y: number; w: number; h: number; docH: number; figs: Record<string, Fig> };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const sameDevice = (a: IpLayouts, b: IpLayouts, d: IpDevice) => JSON.stringify(IP_CHAR_IDS.map((id) => a[id][d])) === JSON.stringify(IP_CHAR_IDS.map((id) => b[id][d]));

/**
 * 預覽＝真正的首頁（iframe 載入 /?ipPreview=1，寬度就是所選裝置的寬度，所以版面、斷點、標題、搜尋框、按鈕、裝飾、IP 角色全部是真的）。
 * 草稿版面用 postMessage 傳進去顯示，不需要先儲存。iframe 本身不可操作，拖曳只發生在上面的「控制框」。
 */
function Preview({
  device,
  width,
  height,
  layouts,
  selected,
  onSelect,
  onMove,
  reloadKey,
}: {
  device: IpDevice;
  width: number;
  height: number;
  layouts: IpLayouts;
  selected: IpCharId;
  onSelect: (id: IpCharId) => void;
  onMove: (id: IpCharId, p: Partial<IpDeviceSettings>) => void;
  reloadKey: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [cw, setCw] = useState(0);
  const [hero, setHero] = useState<Hero | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;
  const scale = cw > 0 ? Math.min(1, cw / width) : 0;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "nande-ip-set", layouts: layoutsRef.current }, window.location.origin);
  }, []);
  useEffect(() => {
    send();
  }, [layouts, send]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { type?: string } & Partial<Hero>;
      if (d?.type === "nande-ip-ready") send();
      if (d?.type === "nande-ip-hero" && typeof d.w === "number" && typeof d.h === "number") setHero({ y: d.y ?? 0, w: d.w, h: d.h, docH: d.docH ?? 0, figs: d.figs ?? {} });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [send]);

  const frameH = hero ? Math.min(Math.max(hero.y + hero.h + 24, 200), hero.docH || 4000) : Math.min(height, 700);
  const drag = useRef<{ id: IpCharId; sx: number; sy: number; left: number; top: number; w: number; h: number } | null>(null);

  return (
    <div className="w-full">
      <p className="mb-1 text-center text-xs text-ink-400">
        {width} px 寬的真實首頁（{DEVICE_RANGE[device]}的版面）｜在預覽上拖曳角色即可移動，只會移動被選取的那一隻
      </p>
      <div ref={boxRef} className="relative mx-auto overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800 bg-canvas-light" style={{ height: scale ? frameH * scale : 200, maxWidth: width }} data-testid="ip-preview-box">
        <iframe
          key={reloadKey}
          ref={frameRef}
          title={`${device} preview`}
          data-testid="ip-preview-frame"
          src="/?ipPreview=1"
          onLoad={() => {
            setLoadFailed(false);
            send();
          }}
          onError={() => setLoadFailed(true)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
          style={{ width, height: frameH, transform: `scale(${scale || 1})`, transformOrigin: "top left" }}
        />
        {loadFailed && <p className="absolute inset-0 flex items-center justify-center text-xs text-red-500">預覽載入失敗，請重新整理頁面。</p>}
        {hero && scale > 0 && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute border border-dashed border-white/60" style={{ left: 0, top: hero.y * scale, width: hero.w * scale, height: hero.h * scale }} />
            {IP_CHAR_IDS.map((id) => {
              const f = hero.figs[id];
              if (!f || f.w <= 0) return null;
              const s = layouts[id][device];
              const sel = id === selected;
              return (
                <div
                  key={id}
                  data-testid={`ip-handle-${id}`}
                  title={`${IP_CHAR_NAMES[id].zh}（拖曳移動）`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(id);
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    drag.current = { id, sx: e.clientX, sy: e.clientY, left: f.left, top: f.top, w: f.w, h: f.h };
                  }}
                  onPointerMove={(e) => {
                    const g = drag.current;
                    if (!g || g.id !== id) return;
                    // 錨點式座標：x = 角色左緣 / (主視覺寬 − 角色寬)；y 同理 → 角色永遠不會被拖出主視覺區
                    const left = g.left + (e.clientX - g.sx) / scale;
                    const top = g.top + (e.clientY - g.sy) / scale;
                    const p: Partial<IpDeviceSettings> = {};
                    if (hero.w - g.w > 0.5) p.x = r1(clampN((left / (hero.w - g.w)) * 100, 0, 100));
                    if (hero.h - g.h > 0.5) p.y = r1(clampN((top / (hero.h - g.h)) * 100, 0, 100));
                    onMove(id, p);
                  }}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                  className={`pointer-events-auto absolute cursor-move touch-none ${sel ? "border-2 border-solid border-lantern-500 bg-lantern-500/10" : "border border-dashed border-white/90"}`}
                  style={{ left: f.left * scale, top: (hero.y + f.top) * scale, width: f.w * scale, height: f.h * scale, transform: `rotate(${s.rotate}deg)` }}
                >
                  <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-black/60 px-1.5 text-[10px] text-white">
                    {IP_CHAR_NAMES[id].zh}
                    {!s.visible ? "（已隱藏）" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NumberRow({ label, value, min, max, step = 1, onChange, testid }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; testid: string }) {
  return (
    <label className="block text-xs text-ink-400">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" aria-label={`${label}滑桿`} />
        <input type="number" data-testid={testid} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${inputCls} !w-20`} />
      </div>
    </label>
  );
}

export default function IpLayoutAdmin() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<IpLayouts | null>(null);
  const [device, setDevice] = useState<IpDevice>("desktop");
  const [selected, setSelected] = useState<IpCharId>("characterA");
  const [sizeIdx, setSizeIdx] = useState<Record<IpDevice, number>>({ desktop: 0, tablet: 0, mobile: 0 });
  const [copyFrom, setCopyFrom] = useState<IpDevice>("desktop");
  const [status, setStatus] = useState<StatusMessage>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [ratio, setRatio] = useState<Record<string, string>>({});

  async function load(keepDraft = false) {
    try {
      const r = await fetch("/api/admin/ip-layout", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "登入已過期，請重新登入管理後台。" : j.error || "讀取失敗，請重新整理頁面。");
      setSnap(j);
      if (!keepDraft) setDraft(clone(j.layouts));
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message || "無法連到伺服器，請確認網站是否正在執行。" });
    }
  }
  useEffect(() => {
    load();
  }, []);

  const dirty = useMemo(() => {
    const out: Record<IpDevice, boolean> = { desktop: false, tablet: false, mobile: false };
    if (snap && draft) for (const d of IP_DEVICES) out[d] = !sameDevice(draft, snap.layouts, d);
    return out;
  }, [snap, draft]);
  const anyDirty = dirty.desktop || dirty.tablet || dirty.mobile;
  useEffect(() => {
    if (!anyDirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [anyDirty]);

  // 圖片原始比例（只讀顯示；高度永遠依這個比例自動決定，不會變形）
  useEffect(() => {
    if (!snap) return;
    for (const id of IP_CHAR_IDS) {
      const im = new Image();
      im.onload = () => setRatio((r) => ({ ...r, [id]: `${im.naturalWidth} : ${im.naturalHeight}` }));
      im.src = snap.images[id].src;
    }
  }, [snap]);

  const patch = useCallback(
    (id: IpCharId, p: Partial<IpDeviceSettings>) => {
      setDraft((d) => {
        if (!d) return d;
        const next = clone(d);
        next[id][device] = sanitizeIpDevice({ ...next[id][device], ...p }, next[id][device]);
        return next;
      });
    },
    [device]
  );

  async function call(key: string, fn: () => Promise<Response>, ok: string, after?: (j: any) => void) {
    setBusy(key);
    setStatus(null);
    try {
      const r = await fn();
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "登入已過期，請重新登入管理後台後再儲存。" : j.error || "操作失敗，請稍後再試。");
      setStatus({ type: "success", text: ok });
      after?.(j);
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message || "無法連到伺服器，請確認網站是否正在執行。" });
    } finally {
      setBusy(null);
    }
  }

  if (!snap || !draft) return <div>{status ? <StatusBanner status={status} /> : <p className="text-sm text-ink-400">載入中…</p>}</div>;

  const cur = draft[selected][device];
  const wopt = PREVIEW_WIDTHS[device][sizeIdx[device]]!;
  const names = IP_CHAR_NAMES;

  const save = () =>
    call(
      "save",
      () => fetch("/api/admin/ip-layout", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device, items: Object.fromEntries(IP_CHAR_IDS.map((id) => [id, draft[id][device]])) }) }),
      `已儲存「${DEVICE_LABEL[device]}」的角色版面。前台${DEVICE_RANGE[device]}的畫面已更新；其他兩種裝置沒有被改動。`,
      (j) => {
        setSnap(j);
        setDraft((d) => {
          // 只把剛儲存的這個裝置視為已儲存；其他裝置的未儲存草稿保留
          if (!d) return d;
          const next = clone(d);
          for (const id of IP_CHAR_IDS) next[id][device] = clone(j.layouts[id][device]);
          return next;
        });
      }
    );

  return (
    <div>
      <StatusBanner status={status} />
      {!snap.tableReady && (
        <p className="mb-4 rounded-lg bg-lantern-500/10 px-3 py-2 text-sm text-lantern-700 dark:text-lantern-300">
          「IP 角色版面」資料表尚未建立，目前首頁使用預設版面，也還不能儲存。請先關閉網站、執行 <code>npm run db:push</code>（會自動先備份資料庫，只新增資料表、不影響現有資料），再重新啟動網站。
        </p>
      )}

      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {IP_DEVICES.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={device === d}
            data-testid={`tab-${d}`}
            onClick={() => setDevice(d)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${device === d ? "border-transit-500 bg-transit-500 text-white" : "border-ink-100 dark:border-ink-800 hover:border-transit-400"}`}
          >
            {DEVICE_LABEL[d]}
            {dirty[d] && <span className="ml-1 text-lantern-300" title="有尚未儲存的修改">●</span>}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-400">
          預覽尺寸
          <select data-testid="size-select" value={sizeIdx[device]} onChange={(e) => setSizeIdx({ ...sizeIdx, [device]: Number(e.target.value) })} className={`${inputCls} !w-auto`}>
            {PREVIEW_WIDTHS[device].map((o, i) => (
              <option key={o.w} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-3 text-xs text-ink-400">
        {DEVICE_LABEL[device]}的設定用於{DEVICE_RANGE[device]}的螢幕；三種裝置各自儲存、互不影響。
        {!snap.saved[selected][device] && "（這個裝置還沒有儲存過，目前顯示的是預設位置。）"}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Preview device={device} width={wopt.w} height={wopt.h} layouts={draft} selected={selected} onSelect={setSelected} onMove={patch} reloadKey={reloadKey} />

        <div className="space-y-4">
          <div role="tablist" className="grid grid-cols-3 gap-2">
            {IP_CHAR_IDS.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={selected === id}
                data-testid={`pick-${id}`}
                onClick={() => setSelected(id)}
                className={`rounded-lg border px-2 py-1.5 text-sm ${selected === id ? "border-lantern-500 bg-lantern-500/10" : "border-ink-100 dark:border-ink-800"}`}
              >
                {names[id].zh}
                <span className="block text-[10px] text-ink-400">{names[id].en}</span>
              </button>
            ))}
          </div>

          <fieldset className="rounded-lg border border-ink-100 dark:border-ink-800 p-3">
            <legend className="px-1 text-sm font-medium">
              {names[selected].zh}｜{DEVICE_LABEL[device]}
            </legend>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" data-testid="f-visible" checked={cur.visible} onChange={(e) => patch(selected, { visible: e.target.checked })} /> 在{DEVICE_LABEL[device]}顯示
            </label>
            <label className="mt-1 flex items-center gap-1.5 text-sm">
              <input type="checkbox" data-testid="f-flip" checked={cur.flip} onChange={(e) => patch(selected, { flip: e.target.checked })} /> 左右翻轉
            </label>
            <div className="mt-3 space-y-3">
              <NumberRow testid="f-x" label="水平位置 X（0 貼左緣、100 貼右緣）" value={cur.x} min={0} max={100} step={0.5} onChange={(n) => patch(selected, { x: n })} />
              <NumberRow testid="f-y" label="垂直位置 Y（0 貼上緣、100 貼下緣）" value={cur.y} min={0} max={100} step={0.5} onChange={(n) => patch(selected, { y: n })} />
              <NumberRow testid="f-size" label="顯示大小（佔主視覺寬度 %）" value={cur.size} min={3} max={60} step={0.5} onChange={(n) => patch(selected, { size: n })} />
              <NumberRow testid="f-rotate" label="旋轉角度（度）" value={cur.rotate} min={-180} max={180} onChange={(n) => patch(selected, { rotate: n })} />
            </div>
            <p className="mt-3 text-xs text-ink-400" data-testid="ratio-note">
              寬高比例：依原圖鎖定{ratio[selected] ? `（${ratio[selected]}）` : ""}，只調整大小時高度會自動跟著算，圖片不會變形。寬度限制在 {MIN_PX}～{MAX_PX} px 之間。
            </p>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" data-testid="btn-save" disabled={!!busy || !snap.tableReady || !dirty[device]} onClick={save} className={`${btn} col-span-2 !border-transit-500 !bg-transit-500 text-white`}>
              {busy === "save" ? "儲存中…" : `儲存${DEVICE_LABEL[device]}`}
            </button>
            <button
              type="button"
              data-testid="btn-cancel"
              disabled={!!busy || !dirty[device]}
              onClick={() => {
                setDraft((d) => {
                  if (!d) return d;
                  const next = clone(d);
                  for (const id of IP_CHAR_IDS) next[id][device] = clone(snap.layouts[id][device]);
                  return next;
                });
                setStatus({ type: "success", text: "已取消尚未儲存的修改。" });
              }}
              className={btn}
            >
              取消修改
            </button>
            <button
              type="button"
              data-testid="btn-reset"
              disabled={!!busy || !snap.tableReady}
              onClick={() => {
                if (!window.confirm(`確定要把「${DEVICE_LABEL[device]}」恢復成預設位置嗎？\n只會清掉這個裝置已儲存的角色版面，其他兩種裝置與角色圖片都不受影響。`)) return;
                call("reset", () => fetch(`/api/admin/ip-layout?device=${device}`, { method: "DELETE" }), `已恢復「${DEVICE_LABEL[device]}」的預設角色版面。`, (j) => {
                  setSnap(j);
                  setDraft((d) => {
                    if (!d) return d;
                    const next = clone(d);
                    for (const id of IP_CHAR_IDS) next[id][device] = clone(j.layouts[id][device]);
                    return next;
                  });
                });
              }}
              className={btn}
            >
              恢復預設位置
            </button>
            <div className="col-span-2 flex items-center gap-2">
              <select data-testid="copy-from" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value as IpDevice)} className={`${inputCls} !w-auto flex-1`} aria-label="複製來源裝置">
                {IP_DEVICES.filter((d) => d !== device).map((d) => (
                  <option key={d} value={d}>
                    從{DEVICE_LABEL[d]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="btn-copy"
                disabled={!!busy || copyFrom === device}
                onClick={() => {
                  const from = copyFrom === device ? IP_DEVICES.find((d) => d !== device)! : copyFrom;
                  setDraft((d) => {
                    if (!d) return d;
                    const next = clone(d);
                    for (const id of IP_CHAR_IDS) next[id][device] = clone(d[id][from]);
                    return next;
                  });
                  setStatus({ type: "success", text: `已把「${DEVICE_LABEL[from]}」的配置複製到「${DEVICE_LABEL[device]}」作為起點。請在預覽中微調，確認後按「儲存」才會生效。` });
                }}
                className={btn}
              >
                複製配置
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-bold">角色外觀圖片</h2>
        <p className="mt-1 text-sm text-ink-400">
          更換後，首頁三種裝置的這隻角色都會改用新圖片（前台立刻生效，不需要再到別處設定）；角色的位置、大小與角度不會被重設。
          威洛小助理與「IP 角色」身分卡頁各有自己的圖片設定，不受這裡影響。
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {IP_CHAR_IDS.map((id) => (
            <div key={id} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3" data-testid={`img-${id}`}>
              <ImageUploader
                label={`${names[id].zh} ${names[id].en}`}
                value={snap.images[id].src}
                fit="contain"
                showRemove={false}
                onChange={(url) =>
                  call(`img-${id}`, () => fetch("/api/admin/ip-layout/image", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: id, url }) }), `已更換「${names[id].zh}」的外觀圖片，首頁已使用新圖片。`, () => {
                    load(true);
                    setReloadKey((k) => k + 1);
                  })
                }
              />
              <p className="mt-1 text-xs text-ink-400">{snap.images[id].custom ? "目前使用：後台上傳的圖片" : "目前使用：內建圖片"}</p>
              {snap.images[id].custom && (
                <button
                  type="button"
                  className={`${btn} mt-2`}
                  disabled={!!busy}
                  onClick={() => {
                    if (!window.confirm(`確定要把「${names[id].zh}」恢復成內建圖片嗎？\n上傳的圖片若沒有其他地方在使用，會移到 uploads\\_trash（可找回）。`)) return;
                    call(`img-${id}`, () => fetch("/api/admin/ip-layout/image", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: id, url: "" }) }), `已把「${names[id].zh}」恢復成內建圖片。`, () => {
                      load(true);
                      setReloadKey((k) => k + 1);
                    });
                  }}
                >
                  恢復內建圖片
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
