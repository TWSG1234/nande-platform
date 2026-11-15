"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ITEM_KINDS, LINK_COLORS, MAX_LINKS, PAGE_TARGETS, safeExternalUrl, type AnnouncementLink, type AnnouncementLinkSetData, type ItemKind } from "@/lib/announcementLinks";

const inputCls = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-transit-500";
type Options = Partial<Record<ItemKind, { id: string; name: string }[]>>;
const uid = () => `l-${Math.random().toString(36).slice(2, 8)}`;

export default function AnnouncementLinksEditor({ value, onChange, tableReady = true }: { value: AnnouncementLinkSetData; onChange: (v: AnnouncementLinkSetData) => void; tableReady?: boolean }) {
  const [options, setOptions] = useState<Options>({});
  useEffect(() => {
    fetch("/api/admin/announcements/link-targets")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => setOptions(j))
      .catch(() => {});
  }, []);
  const set = (i: number, p: Partial<AnnouncementLink>) => onChange({ ...value, links: value.links.map((l, k) => (k === i ? { ...l, ...p } : l)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.links.length) return;
    const a = [...value.links];
    [a[i], a[j]] = [a[j]!, a[i]!];
    onChange({ ...value, links: a });
  };
  const add = () => onChange({ ...value, links: [...value.links, { id: uid(), labelZh: "", labelEn: "", color: LINK_COLORS[value.links.length % LINK_COLORS.length]!.value, target: { type: "page", path: "/life" } }] });

  return (
    <fieldset className="space-y-3 rounded-xl border border-ink-100 p-4 dark:border-ink-800" data-testid="links-editor">
      <legend className="px-1 text-sm font-semibold">文字連結（顯示在公告下方的一小排文字，只有這些文字可以點）</legend>
      {!tableReady && <p className="rounded bg-lantern-500/10 px-2 py-1 text-xs">「文字連結」資料表尚未建立（請先執行 npm run db:push），目前無法儲存連結。</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" data-testid="links-show" checked={value.show} onChange={(e) => onChange({ ...value, show: e.target.checked })} /> 在前台顯示連結區
      </label>
      {value.links.map((l, i) => {
        const t = l.target;
        const bad = t.type === "external" && t.url !== "" && !safeExternalUrl(t.url);
        return (
          <div key={l.id} data-testid="link-row" className="space-y-2 rounded-lg bg-ink-50 p-3 dark:bg-white/5">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-ink-400">
                顯示文字（中文）
                <input data-testid="link-labelZh" maxLength={20} className={inputCls} value={l.labelZh} onChange={(e) => set(i, { labelZh: e.target.value })} placeholder="例：校園介紹" />
              </label>
              <label className="text-xs text-ink-400">
                顯示文字（English，沒填就顯示中文）
                <input maxLength={40} className={inputCls} value={l.labelEn} onChange={(e) => set(i, { labelEn: e.target.value })} placeholder="Campus Guide" />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-xs text-ink-400">
                跳轉到
                <select
                  data-testid="link-ttype"
                  className={inputCls}
                  value={t.type}
                  onChange={(e) => set(i, { target: e.target.value === "page" ? { type: "page", path: "/life" } : e.target.value === "item" ? { type: "item", kind: "life", id: "" } : { type: "external", url: "https://" } })}
                >
                  <option value="page">站內頁面</option>
                  <option value="item">站內指定內容</option>
                  <option value="external">外部網址（https）</option>
                </select>
              </label>
              <div className="text-xs text-ink-400">
                {t.type === "page" && (
                  <label>
                    頁面
                    <select data-testid="link-page" className={inputCls} value={t.path} onChange={(e) => set(i, { target: { type: "page", path: e.target.value } })}>
                      {PAGE_TARGETS.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.zh}（{p.path}）
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {t.type === "item" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label>
                      內容類型
                      <select className={inputCls} value={t.kind} onChange={(e) => set(i, { target: { type: "item", kind: e.target.value as ItemKind, id: "" } })}>
                        {ITEM_KINDS.map((k) => (
                          <option key={k.kind} value={k.kind}>
                            {k.zh}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      項目（以資料 ID 連結，之後改名稱也不會失效）
                      <select data-testid="link-item" className={inputCls} value={t.id} onChange={(e) => set(i, { target: { type: "item", kind: t.kind, id: e.target.value } })}>
                        <option value="">請選擇…</option>
                        {(options[t.kind] ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {t.type === "external" && (
                  <label>
                    網址（只允許 https://）
                    <input data-testid="link-url" className={`${inputCls} ${bad ? "border-red-400" : ""}`} value={t.url} onChange={(e) => set(i, { target: { type: "external", url: e.target.value } })} placeholder="https://example.com" />
                    {bad && <span className="text-red-500">網址不合法：只允許 https:// 開頭的網址。</span>}
                  </label>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
              文字顏色
              {LINK_COLORS.map((c) => (
                <button key={c.value} type="button" title={c.zh} aria-label={`顏色 ${c.zh}`} aria-pressed={l.color === c.value} onClick={() => set(i, { color: c.value })} className={`h-6 w-6 rounded-full border-2 ${l.color === c.value ? "border-ink-800 dark:border-white" : "border-transparent"}`} style={{ background: c.value }} />
              ))}
              <input type="color" aria-label="自訂顏色" value={l.color} onChange={(e) => set(i, { color: e.target.value })} className="h-6 w-8 cursor-pointer" />
              <span className="ml-auto flex gap-1">
                <button type="button" aria-label="往前" className="rounded border border-ink-100 p-1" onClick={() => move(i, -1)}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" aria-label="往後" className="rounded border border-ink-100 p-1" onClick={() => move(i, 1)}>
                  <ArrowDown size={14} />
                </button>
                <button type="button" data-testid="link-delete" aria-label="刪除這個連結" className="rounded border border-red-300 p-1 text-red-600" onClick={() => onChange({ ...value, links: value.links.filter((_, k) => k !== i) })}>
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          </div>
        );
      })}
      <button type="button" data-testid="link-add" disabled={value.links.length >= MAX_LINKS} onClick={add} className="inline-flex items-center gap-1 rounded-lg border border-transit-400 px-3 py-1.5 text-sm text-transit-600 disabled:opacity-50">
        <Plus size={14} /> 新增文字連結
      </button>
      {value.links.length > 0 && (
        <p className="text-xs text-ink-400" data-testid="links-preview">
          預覽：相關資訊：
          {value.links.map((l, i) => (
            <span key={l.id}>
              {i > 0 && "｜"}
              <span style={{ color: l.color }} className="font-semibold">
                {l.labelZh || "（未填文字）"}
              </span>
            </span>
          ))}
          {!value.show && "（目前設為不顯示）"}
        </p>
      )}
    </fieldset>
  );
}
