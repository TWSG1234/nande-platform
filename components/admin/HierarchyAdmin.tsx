"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import BilingualField from "@/components/admin/BilingualField";
import InfoCard, { DecorStyle } from "@/components/InfoCard";
import type { EnglishSource } from "@/lib/translationService";

/**
 * 生活座標／校園座標共用的「座標主頁 → 大分類 → 資訊框」管理畫面。
 * 分類與資訊框都用 ID 關聯：改名稱、調順序都不會讓底下的資訊框錯位。
 */
export type Scope = "life" | "campus";
type Cat = { id: string; nameZh: string; nameEn: string; descriptionZh: string; descriptionEn: string; order: number; isPublished: boolean };
type Box = { id: string; catId: string; titleZh: string; detailZh: string; order: number; isPublished: boolean };
type Draft = { id: string; isNew: boolean; nameZh: string; nameEn: string; nameEnSource: EnglishSource; descriptionZh: string; descriptionEn: string; descriptionEnSource: EnglishSource; icon?: string };

const CFG = {
  life: { title: "生活座標管理", cats: "/api/admin/life-categories", boxes: "/api/admin/life-items", boxKey: "items", catField: "categoryId", titleField: "titleZh", descField: "detailZh", edit: (id: string) => `/admin/life/${id}/edit`, add: (c: string) => `/admin/life/new?category=${encodeURIComponent(c)}`, reorderCat: "life-category", reorderBox: "life-item" },
  campus: { title: "校園座標管理", cats: "/api/admin/campus-categories", boxes: "/api/admin/campus", boxKey: "spots", catField: "category", titleField: "nameZh", descField: "descriptionZh", edit: (id: string) => `/admin/campus/${id}/edit`, add: (c: string) => `/admin/campus/new?category=${encodeURIComponent(c)}`, reorderCat: "campus-category", reorderBox: "campus-spot" },
} as const;
const input = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";
const jsonHeaders = { "Content-Type": "application/json" };

export default function HierarchyAdmin({ scope }: { scope: Scope }) {
  const c = CFG[scope];
  const [cats, setCats] = useState<Cat[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [del, setDel] = useState<{ cat: Cat; count: number; to: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cr, br] = await Promise.all([fetch(c.cats, { cache: "no-store" }), fetch(c.boxes, { cache: "no-store" })]);
      const cj = await cr.json().catch(() => ({}));
      const bj = await br.json().catch(() => ({}));
      if (!cr.ok && cr.status === 401) throw new Error("登入已過期，請重新登入管理後台。");
      if (cj.tableMissing) setStatus({ type: "error", text: cj.error });
      setCats(((cj.categories as Cat[]) ?? []).slice().sort((a, b) => a.order - b.order));
      setBoxes(((bj[c.boxKey] as any[]) ?? []).map((b) => ({ id: b.id, catId: b[c.catField], titleZh: b[c.titleField], detailZh: b[c.descField], order: b.order, isPublished: b.isPublished })));
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message || "讀取失敗，請檢查網路或重新登入後再試。" });
    }
    setLoading(false);
  }, [c]);
  useEffect(() => {
    load();
  }, [load]);

  const catBoxes = (id: string) => boxes.filter((b) => b.catId === id).sort((a, b) => a.order - b.order);
  const orphan = boxes.filter((b) => !cats.some((x) => x.id === b.catId));

  async function reorder(kind: "cat" | "box", ids: string[]) {
    const r = await fetch("/api/admin/reorder", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ scope: kind === "cat" ? c.reorderCat : c.reorderBox, ids }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setStatus({ type: "success", text: "已調整順序。" });
      await load();
    } else setStatus({ type: "error", text: j.error || "調整順序失敗。" });
  }
  const moveCat = (i: number, d: -1 | 1) => {
    const ids = cats.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder("cat", ids);
  };
  const moveBox = (catId: string, i: number, d: -1 | 1) => {
    const ids = catBoxes(catId).map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder("box", ids);
  };

  async function patchCat(cat: Cat, body: object, ok: string) {
    const r = await fetch(`${c.cats}/${encodeURIComponent(cat.id)}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setStatus({ type: "success", text: ok });
      await load();
      return true;
    }
    setStatus({ type: "error", text: j.error || "儲存失敗，請稍後再試一次。" });
    return false;
  }
  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    const body = JSON.stringify(draft);
    const r = draft.isNew ? await fetch(c.cats, { method: "POST", headers: jsonHeaders, body }) : await fetch(`${c.cats}/${encodeURIComponent(draft.id)}`, { method: "PUT", headers: jsonHeaders, body });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setStatus({ type: "success", text: "分類儲存成功！" });
      setDraft(null);
      load();
    } else setStatus({ type: "error", text: j.error || "分類儲存失敗，請稍後再試一次。" });
  }
  async function tryDelete(cat: Cat) {
    const r = await fetch(`${c.cats}/${encodeURIComponent(cat.id)}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setStatus({ type: "success", text: "分類已刪除。" });
      load();
    } else if (r.status === 409 && j.needsChoice) setDel({ cat, count: j.count, to: cats.find((x) => x.id !== cat.id)?.id ?? "" });
    else setStatus({ type: "error", text: j.error || "刪除失敗。" });
  }
  async function confirmDelete(mode: "move" | "cascade") {
    if (!del) return;
    if (mode === "cascade" && !window.confirm(`確定要把分類「${del.cat.nameZh}」連同底下 ${del.count} 個資訊框一起刪除嗎？\n資訊框的圖片只有在其他地方沒有使用時，才會移到 uploads\\_trash（可找回）。這個動作無法復原。`)) return;
    const q = mode === "move" ? `?mode=move&to=${encodeURIComponent(del.to)}` : "?mode=cascade";
    const r = await fetch(`${c.cats}/${encodeURIComponent(del.cat.id)}${q}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setStatus({ type: "success", text: mode === "move" ? `已把 ${j.moved} 個資訊框移到其他分類，並刪除分類。` : `已刪除分類與 ${j.deleted} 個資訊框。` });
      setDel(null);
      load();
    } else setStatus({ type: "error", text: j.error || "刪除失敗。" });
  }
  async function togglePublish(b: Box) {
    const r = await fetch(`${c.boxes}/${b.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ isPublished: !b.isPublished }) });
    if (r.ok) load();
    else setStatus({ type: "error", text: "操作失敗，請稍後再試一次。" });
  }
  async function delBox(b: Box) {
    if (!confirm(`確定要刪除資訊框「${b.titleZh}」嗎？刪除後無法復原（它的裝飾圖片也會一併移除）。`)) return;
    const r = await fetch(`${c.boxes}/${b.id}`, { method: "DELETE" });
    if (r.ok) {
      setStatus({ type: "success", text: "刪除成功！" });
      load();
    } else setStatus({ type: "error", text: "刪除失敗，請稍後再試一次。" });
  }

  return (
    <div>
      <DecorStyle />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">{c.title}</h1>
        <button type="button" data-testid="cat-add" onClick={() => setDraft({ id: "", isNew: true, nameZh: "", nameEn: "", nameEnSource: "AUTO", descriptionZh: "", descriptionEn: "", descriptionEnSource: "AUTO", icon: "Lightbulb" })} className="flex items-center gap-1.5 rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white">
          <Plus size={16} /> 新增大分類
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-400">結構：{scope === "life" ? "生活座標" : "校園座標"}主頁 → 大分類 → 資訊框。資訊框一定屬於某個大分類（用代碼關聯，改分類名稱或調順序都不會錯位）。</p>
      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      {draft && (
        <div className="mb-4 space-y-3 rounded-xl border border-dashed border-ink-100 p-4 dark:border-ink-800" data-testid="cat-form">
          <h2 className="text-sm font-bold">{draft.isNew ? "新增大分類" : "編輯大分類"}</h2>
          {draft.isNew && (
            <div>
              <label className="mb-1 block text-sm font-medium">分類代碼（僅英數字、-、_，之後不能修改）</label>
              <input data-testid="cat-id" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="例如：night-market" className={input} />
            </div>
          )}
          <BilingualField labelZh="分類名稱（中文）" labelEn="Name (English)" required value={{ zh: draft.nameZh, en: draft.nameEn, source: draft.nameEnSource }} onChange={(n) => setDraft({ ...draft, nameZh: n.zh, nameEn: n.en, nameEnSource: n.source })} />
          <BilingualField labelZh="分類說明（中文）" labelEn="Description (English)" multiline value={{ zh: draft.descriptionZh, en: draft.descriptionEn, source: draft.descriptionEnSource }} onChange={(n) => setDraft({ ...draft, descriptionZh: n.zh, descriptionEn: n.en, descriptionEnSource: n.source })} />
          <div className="flex gap-2">
            <button type="button" data-testid="cat-save" disabled={busy} onClick={saveDraft} className="rounded-lg bg-transit-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "儲存中…" : "儲存分類"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-ink-100 px-4 py-2 text-sm dark:border-ink-800">
              取消
            </button>
          </div>
        </div>
      )}

      {del && (
        <div role="dialog" aria-label="刪除分類" data-testid="cat-delete-dialog" className="mb-4 space-y-2 rounded-xl border border-red-300 bg-red-500/5 p-4 text-sm">
          <p>
            分類「<b>{del.cat.nameZh}</b>」底下還有 <b>{del.count}</b> 個資訊框，請選擇怎麼處理：
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={del.to} onChange={(e) => setDel({ ...del, to: e.target.value })} className={`${input} !w-auto`} aria-label="移動到的分類">
              {cats.filter((x) => x.id !== del.cat.id).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nameZh}
                </option>
              ))}
            </select>
            <button type="button" data-testid="del-move" disabled={!del.to} onClick={() => confirmDelete("move")} className="rounded-lg bg-transit-500 px-3 py-1.5 text-white disabled:opacity-50">
              把資訊框移到這個分類，再刪除分類
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="del-cascade" onClick={() => confirmDelete("cascade")} className="rounded-lg border border-red-400 px-3 py-1.5 text-red-600">
              連同 {del.count} 個資訊框一起刪除
            </button>
            <button type="button" onClick={() => setDel(null)} className="rounded-lg border border-ink-100 px-3 py-1.5">
              取消，什麼都不刪
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-400">載入中…</p>
      ) : (
        <div className="space-y-5">
          {cats.map((cat, ci) => {
            const list = catBoxes(cat.id);
            return (
              <section key={cat.id} data-testid="cat-block" data-cat-id={cat.id} className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-bold">
                      {cat.nameZh} <span className="text-sm font-normal text-ink-400">／ {cat.nameEn}</span>
                    </h2>
                    {cat.descriptionZh && <p className="text-xs text-ink-400">{cat.descriptionZh}</p>}
                    <p className="text-[11px] text-ink-300">代碼：{cat.id}</p>
                  </div>
                  <button type="button" onClick={() => patchCat(cat, { isPublished: !cat.isPublished }, cat.isPublished ? "已隱藏這個分類（前台不顯示，底下資訊框保留）。" : "已顯示這個分類。")} className={`rounded-full px-2.5 py-1 text-xs ${cat.isPublished ? "bg-green-500/10 text-green-600 dark:text-green-300" : "bg-ink-100 text-ink-400 dark:bg-white/10"}`}>
                    {cat.isPublished ? "顯示中" : "已隱藏"}
                  </button>
                  <button type="button" aria-label="分類往前" onClick={() => moveCat(ci, -1)} className="rounded border border-ink-100 p-1.5"><ArrowUp size={14} /></button>
                  <button type="button" aria-label="分類往後" onClick={() => moveCat(ci, 1)} className="rounded border border-ink-100 p-1.5"><ArrowDown size={14} /></button>
                  <button type="button" aria-label="預覽分類" onClick={() => setPreview(preview === cat.id ? null : cat.id)} className="rounded border border-ink-100 p-1.5"><Eye size={14} /></button>
                  <button type="button" aria-label="編輯分類" data-testid="cat-edit" onClick={() => setDraft({ id: cat.id, isNew: false, nameZh: cat.nameZh, nameEn: cat.nameEn, nameEnSource: "MANUAL", descriptionZh: cat.descriptionZh, descriptionEn: cat.descriptionEn, descriptionEnSource: "MANUAL" })} className="rounded border border-ink-100 p-1.5"><Pencil size={14} /></button>
                  <button type="button" aria-label="刪除分類" data-testid="cat-delete" onClick={() => tryDelete(cat)} className="rounded border border-red-300 p-1.5 text-red-500"><Trash2 size={14} /></button>
                </div>

                {preview === cat.id && (
                  <div className="mt-3 rounded-lg bg-ink-50 p-3 dark:bg-white/5" data-testid="cat-preview">
                    <p className="mb-2 text-xs text-ink-400">前台顯示預覽（只顯示「顯示中」的資訊框；裝飾圖片請在資訊框的編輯頁調整）</p>
                    <h3 className="font-display text-base font-semibold">{cat.nameZh}</h3>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {list.filter((b) => b.isPublished).map((b) => (
                        <InfoCard key={b.id} as="div" title={b.titleZh} description={b.detailZh} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {list.map((b, i) => (
                    <div key={b.id} data-testid="box-row" data-box-id={b.id} className="flex items-center gap-2 rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{b.titleZh}</p>
                        <p className="truncate text-xs text-ink-400">{b.detailZh}</p>
                      </div>
                      <button type="button" onClick={() => togglePublish(b)} className={`rounded-full px-2.5 py-1 text-xs ${b.isPublished ? "bg-green-500/10 text-green-600 dark:text-green-300" : "bg-ink-100 text-ink-400 dark:bg-white/10"}`}>
                        {b.isPublished ? "顯示中" : "已隱藏"}
                      </button>
                      <button type="button" aria-label="往前" onClick={() => moveBox(cat.id, i, -1)} className="rounded border border-ink-100 p-1.5"><ArrowUp size={14} /></button>
                      <button type="button" aria-label="往後" onClick={() => moveBox(cat.id, i, 1)} className="rounded border border-ink-100 p-1.5"><ArrowDown size={14} /></button>
                      <Link href={c.edit(b.id)} aria-label="編輯資訊框" className="rounded border border-ink-100 p-1.5"><Pencil size={14} /></Link>
                      <button type="button" aria-label="刪除資訊框" onClick={() => delBox(b)} className="rounded border border-red-300 p-1.5 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {list.length === 0 && <p className="text-sm text-ink-400">這個分類目前沒有資訊框。</p>}
                  <Link href={c.add(cat.id)} className="inline-flex items-center gap-1 rounded-lg border border-transit-400 px-3 py-1.5 text-sm text-transit-600">
                    <Plus size={14} /> 在「{cat.nameZh}」新增資訊框
                  </Link>
                </div>
              </section>
            );
          })}
          {orphan.length > 0 && (
            <section className="rounded-xl border border-lantern-500/50 p-4 text-sm">
              <p className="font-semibold">有 {orphan.length} 個資訊框的所屬分類不存在（資料不一致），前台會顯示在「（未分類）」。請編輯它們並重新選擇分類：</p>
              {orphan.map((b) => (
                <Link key={b.id} href={c.edit(b.id)} className="mt-1 block text-transit-600 underline">
                  {b.titleZh}
                </Link>
              ))}
            </section>
          )}
          {cats.length === 0 && <p className="text-sm text-ink-400">目前沒有分類，請先新增大分類。</p>}
        </div>
      )}
    </div>
  );
}
