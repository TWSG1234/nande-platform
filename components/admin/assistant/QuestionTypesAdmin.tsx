"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Undo2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import ImageUploader from "@/components/admin/ImageUploader";
import { SIGNAL_OPTIONS, SYSTEM_STATES, type QuestionTypeData } from "@/lib/ai/questionTypes";

const inputCls = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";
type Draft = Omit<QuestionTypeData, "id" | "key"> & { id: string | null; key: string | null; keywordsText: string };
const blank = (): Draft => ({ id: null, key: null, nameZh: "", nameEn: "", labelZh: "", labelEn: "", signals: [], keywords: [], keywordsText: "", imageUrl: "", enabled: true, priority: 100 });
const toDraft = (t: QuestionTypeData): Draft => ({ ...t, keywordsText: t.keywords.join("\n") });
const GROUP: Record<string, string> = { topic: "問題主題（沿用既有主題分類）", source: "答案來自哪個資料（最相關的那一筆）", flow: "搜尋流程結果" };

export default function QuestionTypesAdmin() {
  const [items, setItems] = useState<Draft[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<StatusMessage>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const snap = (d: Draft) => JSON.stringify({ ...d, keywords: undefined });
  async function load() {
    try {
      const r = await fetch("/api/admin/assistant/question-types", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "登入已過期，請重新登入管理後台。" : j.error || "讀取失敗。");
      const list = (j.types as QuestionTypeData[]).map(toDraft);
      setItems(list);
      setSaved(Object.fromEntries(list.map((d) => [d.id!, snap(d)])));
      setTableMissing(!!j.tableMissing);
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message });
    }
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  const patch = (i: number, p: Partial<Draft>) => setItems((a) => a.map((d, k) => (k === i ? { ...d, ...p } : d)));
  const dirty = (d: Draft) => d.id === null || saved[d.id] !== snap(d);

  async function api(key: string, init: RequestInit, ok: string) {
    setBusy(key);
    setStatus(null);
    try {
      const r = await fetch("/api/admin/assistant/question-types", { ...init, headers: { "Content-Type": "application/json" } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? "登入已過期，請重新登入管理後台。" : j.error || "操作失敗，請稍後再試。");
      setStatus({ type: "success", text: ok });
      return j;
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message || "無法連到伺服器。" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save(i: number) {
    const d = items[i]!;
    const body = { ...d, keywords: d.keywordsText };
    const j = await api(`save-${i}`, { method: d.id ? "PUT" : "POST", body: JSON.stringify(body) }, `已儲存「${d.nameZh || "新類型"}」，前台下一次提問就會使用。`);
    if (j?.type) {
      const nd = toDraft(j.type);
      setItems((a) => a.map((x, k) => (k === i ? nd : x)));
      setSaved((s) => ({ ...s, [nd.id!]: snap(nd) }));
    }
  }
  async function reallyDelete(i: number) {
    const d = items[i]!;
    setBusy(`del-${i}`);
    setStatus(null);
    try {
      const r = await fetch(`/api/admin/assistant/question-types?id=${encodeURIComponent(d.id!)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "刪除失敗。");
      setItems((a) => a.filter((_, k) => k !== i));
      setStatus({ type: "success", text: `已刪除「${d.nameZh}」。` });
    } catch (e) {
      setStatus({ type: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length || items.some((d) => !d.id)) return setStatus({ type: "error", text: "請先儲存新增中的類型，再調整順序。" });
    const order = items.map((d) => d.id!);
    [order[i], order[j]] = [order[j]!, order[i]!];
    const res = await api("order", { method: "PUT", body: JSON.stringify({ order }) }, "已調整順序（排在前面的優先判斷）。");
    if (res?.types) {
      const list = (res.types as QuestionTypeData[]).map(toDraft);
      // 保留尚未儲存的編輯內容，只換順序
      setItems(order.map((id) => items.find((d) => d.id === id)!).map((d, idx) => ({ ...d, priority: list[idx]?.priority ?? d.priority })));
      setSaved(Object.fromEntries(list.map((d) => [d.id!, snap(d)])));
    }
  }

  if (!loaded) return <p className="text-sm text-ink-400">載入中…</p>;
  return (
    <div className="max-w-4xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">🎭 威洛問題類型與角色狀態</h1>
        <Link href="/admin/assistant" className="text-sm text-transit-600 underline">
          ← 回威洛小助理設定
        </Link>
      </div>
      <p className="mb-4 text-sm text-ink-400">
        威洛回答完問題後，會依「問題類型」換成不同的外觀圖片或動畫。判斷沿用目前的搜尋流程（不使用外部 AI）：先找出最相關的網站資料，再依這裡勾選的條件決定類型。
        排在前面的類型優先；都不符合時回到系統狀態。思考中永遠優先使用「思考中」圖片。
      </p>
      <StatusBanner status={status} />
      {tableMissing && (
        <p className="mb-4 rounded-lg bg-lantern-500/10 px-3 py-2 text-sm">
          「問題類型」資料表尚未建立，目前威洛只使用內建狀態。請先關閉網站，執行 <code>npm run db:push</code>（會自動備份，只新增資料表），再重新啟動。
        </p>
      )}

      <section className="mb-6 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
        <h2 className="text-sm font-bold">系統必要狀態（不能刪除，也是安全回退）</h2>
        <ul className="mt-2 grid gap-1 text-xs text-ink-500 sm:grid-cols-2">
          {SYSTEM_STATES.map((s) => (
            <li key={s.key}>
              <b>{s.zh}</b>：{s.note}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-400">這四種狀態的圖片，請在「威洛小助理設定 → 動作圖片」更換。</p>
      </section>

      <div className="space-y-4">
        {items.map((d, i) => (
          <div key={d.id ?? `new-${i}`} data-testid="qtype-card" className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs dark:bg-white/10">優先順序 {i + 1}</span>
              {d.id && <span className="text-xs text-ink-400">代碼：{d.key}</span>}
              {dirty(d) && <span className="text-xs text-lantern-600">● 尚未儲存</span>}
              <label className="ml-auto flex items-center gap-1 text-sm">
                <input type="checkbox" checked={d.enabled} onChange={(e) => patch(i, { enabled: e.target.checked })} /> 啟用
              </label>
              <button type="button" aria-label="往前排" className="rounded border border-ink-100 p-1" onClick={() => move(i, -1)}>
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label="往後排" className="rounded border border-ink-100 p-1" onClick={() => move(i, 1)}>
                <ArrowDown size={14} />
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-ink-400">
                類型名稱（中文）
                <input data-testid="f-nameZh" className={inputCls} value={d.nameZh} onChange={(e) => patch(i, { nameZh: e.target.value })} placeholder="例：交通資訊" />
              </label>
              <label className="text-xs text-ink-400">
                類型名稱（English，選填）
                <input className={inputCls} value={d.nameEn} onChange={(e) => patch(i, { nameEn: e.target.value })} placeholder="Transport" />
              </label>
              <label className="text-xs text-ink-400">
                狀態文字（中文，顯示在威洛旁，選填）
                <input className={inputCls} maxLength={20} value={d.labelZh} onChange={(e) => patch(i, { labelZh: e.target.value })} placeholder="例：幫你查交通中" />
              </label>
              <label className="text-xs text-ink-400">
                狀態文字（English，選填）
                <input className={inputCls} maxLength={30} value={d.labelEn} onChange={(e) => patch(i, { labelEn: e.target.value })} />
              </label>
            </div>

            <fieldset className="mt-3">
              <legend className="text-xs font-semibold">判斷條件（符合任何一項就算這個類型）</legend>
              {(["topic", "source", "flow"] as const).map((g) => (
                <div key={g} className="mt-1">
                  <p className="text-[11px] text-ink-400">{GROUP[g]}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {SIGNAL_OPTIONS.filter((o) => o.group === g).map((o) => (
                      <label key={o.value} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          data-testid={`sig-${o.value}`}
                          checked={d.signals.includes(o.value)}
                          onChange={(e) => patch(i, { signals: e.target.checked ? [...d.signals, o.value] : d.signals.filter((x) => x !== o.value) })}
                        />
                        {o.zh.replace(/^[^：]+：/, "")}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <label className="mt-2 block text-xs text-ink-400">
                輔助關鍵字（選填，一行一個）：只有在搜尋流程已經找到答案時，問題或答案標題含有這些字才會算符合；不會單靠一個字就強制切換。
                <textarea className={`${inputCls} mt-1`} rows={2} value={d.keywordsText} onChange={(e) => patch(i, { keywordsText: e.target.value })} />
              </label>
            </fieldset>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px]">
              <div>
                <ImageUploader label="角色外觀圖片／動畫（沒設定就用系統狀態圖）" fit="contain" value={d.imageUrl} onChange={(url) => patch(i, { imageUrl: url })} removedNote="已清空，按「儲存」後生效。" />
              </div>
              <div data-testid="qtype-preview" className="rounded-lg bg-ink-50 p-3 text-center dark:bg-white/5">
                <p className="mb-1 text-xs text-ink-400">預覽</p>
                <div className="relative mx-auto w-24">
                  {d.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.imageUrl} alt="" className="block h-24 w-full object-contain" />
                  ) : (
                    <div className="flex h-24 items-center justify-center text-xs text-ink-400">未設定圖片</div>
                  )}
                  {d.labelZh && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] shadow">{d.labelZh}</span>}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" data-testid="qtype-save" disabled={!!busy || !dirty(d)} onClick={() => save(i)} className="inline-flex items-center gap-1 rounded-lg bg-transit-500 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                <Save size={14} /> 儲存
              </button>
              <button
                type="button"
                disabled={!!busy || !dirty(d)}
                onClick={() => (d.id ? patch(i, JSON.parse(saved[d.id]!) as Draft) : setItems((a) => a.filter((_, k) => k !== i)))}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-100 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <Undo2 size={14} /> 取消修改
              </button>
              <button
                type="button"
                data-testid="qtype-delete"
                disabled={!!busy}
                onClick={() => {
                  if (!d.id) return setItems((a) => a.filter((_, k) => k !== i));
                  if (window.confirm(`確定要刪除「${d.nameZh}」嗎？\n\n刪除後，原本對應到這個類型的問題會自動回退為系統狀態（生活資訊／暫時無法解決／待機），威洛不會壞。\n目前沒有其他功能引用問題類型。上傳的圖片若全站沒有其他地方使用，會移到 uploads\\_trash（可找回）。`)) reallyDelete(i);
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600"
              >
                <Trash2 size={14} /> 刪除
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-400">還沒有自訂的問題類型。威洛目前只使用系統狀態。</p>}
      </div>
      <button type="button" data-testid="qtype-add" onClick={() => setItems((a) => [...a, { ...blank(), priority: (a.length + 1) * 10 }])} className="mt-4 inline-flex items-center gap-1 rounded-lg border border-transit-400 px-3 py-2 text-sm text-transit-600">
        <Plus size={14} /> 新增問題類型
      </button>
    </div>
  );
}
