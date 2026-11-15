"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Plus, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import ImageUploader from "@/components/admin/ImageUploader";
import AssistantPreview, { PreviewDevice } from "./AssistantPreview";
import { matchMockReply } from "@/lib/ai/mockAIResponse";
import { AVATAR_STATE_LABEL, type AvatarState } from "@/lib/ai/avatarState";
import { resolveStateImage } from "@/components/ai/assistantImage";
import type { AssistantLang, AssistantRuleData, AssistantSettings } from "@/lib/ai/types";

type Tab = "basic" | "appearance" | "rules";
type RuleDraft = AssistantRuleData;
type Defaults = { settings: AssistantSettings; rules: Omit<AssistantRuleData, "id">[] };

let tmpId = 0;
const newId = () => `new-${Date.now()}-${tmpId++}`;
const withIds = (rules: Omit<AssistantRuleData, "id">[]): RuleDraft[] => rules.map((r) => ({ ...r, id: newId() }));

const inputCls = "w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm dark:bg-transparent";
const labelCls = "mb-1 block text-xs font-semibold text-ink-400";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-100 px-3 py-2">
      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-ink-400">{hint}</span>}
      </span>
    </label>
  );
}

function NumberField({ label, value, min, max, unit = "px", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <Field label={`${label}（${min}–${max}${unit}）`}>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className={`${inputCls} w-20`}
        />
      </div>
    </Field>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-ink-100 bg-transparent p-0.5" aria-label={label} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className={`${inputCls} w-28 font-mono`}
          aria-label={`${label} hex`}
        />
      </div>
    </Field>
  );
}

export default function AssistantAdminEditor() {
  const [saved, setSaved] = useState<{ settings: AssistantSettings; rules: RuleDraft[] } | null>(null);
  const [draft, setDraft] = useState<AssistantSettings | null>(null);
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [tab, setTab] = useState<Tab>("basic");
  const [status, setStatus] = useState<StatusMessage>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [previewLang, setPreviewLang] = useState<AssistantLang>("zh-TW");
  const [chatOpen, setChatOpen] = useState(false);
  const [previewState, setPreviewState] = useState<AvatarState | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [testText, setTestText] = useState("");
  const [testLang, setTestLang] = useState<AssistantLang>("zh-TW");

  useEffect(() => {
    fetch("/api/admin/assistant")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "讀取失敗");
        return res.json();
      })
      .then((data: { settings: AssistantSettings; rules: AssistantRuleData[]; defaults: Defaults }) => {
        setSaved({ settings: data.settings, rules: data.rules });
        setDraft(data.settings);
        setRules(data.rules);
        setDefaults(data.defaults);
        setPreviewLang(data.settings.defaultLang);
        setTestLang(data.settings.defaultLang);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const dirty = useMemo(
    () => !!saved && !!draft && (JSON.stringify(saved.settings) !== JSON.stringify(draft) || JSON.stringify(saved.rules) !== JSON.stringify(rules)),
    [saved, draft, rules]
  );

  // 有未儲存變更時，離開頁面前提醒
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // 清單順序＝優先順序（儲存時伺服器也是依順序重新編號），預覽與測試也用同一個規則
  const orderedRules = useMemo(() => rules.map((r, i) => ({ ...r, priority: (i + 1) * 10 })), [rules]);

  const set = useCallback(<K extends keyof AssistantSettings>(key: K, value: AssistantSettings[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }, []);

  const updateRule = (id: string, patch: Partial<RuleDraft>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const moveRule = (index: number, dir: -1 | 1) =>
    setRules((rs) => {
      const j = index + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      const a = next[index];
      const b = next[j];
      if (!a || !b) return rs;
      next[index] = b;
      next[j] = a;
      return next;
    });

  async function save() {
    if (!draft) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: draft, rules }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "error", text: data.error || "儲存失敗，請稍後再試一次。" });
      } else {
        setSaved({ settings: data.settings, rules: data.rules });
        // 資料庫還沒新增動作圖片欄位時，其他設定已存、圖片尚未存：保留編輯中的圖片，不要被清掉
        const keepImages = data.warning
          ? { thinkingImageUrl: draft.thinkingImageUrl, unresolvedImageUrl: draft.unresolvedImageUrl, lifeInfoImageUrl: draft.lifeInfoImageUrl }
          : {};
        setDraft({ ...data.settings, ...keepImages });
        setRules(data.rules);
        setStatus(data.warning ? { type: "error", text: data.warning } : { type: "success", text: "已儲存！前台重新整理後就會套用最新設定。" });
      }
    } catch {
      setStatus({ type: "error", text: "網路錯誤，儲存失敗。" });
    }
    setSaving(false);
  }

  function cancelChanges() {
    if (!saved) return;
    setDraft(saved.settings);
    setRules(saved.rules);
    setStatus({ type: "success", text: "已取消尚未儲存的變更。" });
  }

  function restoreDefaults() {
    if (!defaults) return;
    if (!window.confirm("要把所有設定與關鍵字規則恢復成預設值嗎？\n（只會改變目前的編輯內容，按「儲存設定」後才會正式套用）")) return;
    setDraft(defaults.settings);
    setRules(withIds(defaults.rules));
    setStatus({ type: "success", text: "已載入預設值（尚未儲存）。" });
  }

  function previewChanges() {
    setChatOpen(true);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (loadError)
    return (
      <div>
        <h1 className="font-display text-2xl font-bold">威洛小助理設定</h1>
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">讀取設定失敗：{loadError}</p>
      </div>
    );
  if (!draft || !defaults) return <p className="text-sm text-ink-400">載入中…</p>;

  const testReply = testText.trim()
    ? matchMockReply(testText, testLang, { rules: orderedRules, fallbackZh: draft.fallbackZh, fallbackEn: draft.fallbackEn })
    : "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">🤖 威洛小助理設定</h1>
          <p className="mt-1 text-sm text-ink-400">
            這裡改的內容在按下「儲存設定」之前不會影響前台。目前仍是關鍵字判斷的假 AI，沒有串接任何 AI 服務。
          </p>
        </div>
        {dirty && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700">有尚未儲存的變更</span>}
      </div>

      <div className="sticky top-0 z-20 mt-4 flex flex-wrap items-center gap-2 border-b border-ink-100 bg-canvas-light/95 py-2 backdrop-blur dark:bg-canvas-dark/95">
        <button type="button" onClick={previewChanges} className="inline-flex items-center gap-1.5 rounded-lg border border-transit-500 px-3 py-2 text-sm font-semibold text-transit-600">
          <Eye size={15} /> 預覽變更
        </button>
        <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-lantern-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
          <Save size={15} /> {saving ? "儲存中…" : "儲存設定"}
        </button>
        <button type="button" onClick={cancelChanges} disabled={!dirty} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-2 text-sm disabled:opacity-40">
          <Undo2 size={15} /> 取消變更
        </button>
        <button type="button" onClick={restoreDefaults} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-2 text-sm">
          <RotateCcw size={15} /> 恢復預設值
        </button>
      </div>

      <div className="mt-4">
        <StatusBanner status={status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── 左：設定表單 ─────────────────────────────── */}
        <div>
          <div className="mb-4 flex gap-1 rounded-lg bg-ink-100/60 p-1 text-sm" role="tablist">
            {(
              [
                ["basic", "基本設定"],
                ["appearance", "外觀設定"],
                ["rules", "關鍵字與回覆"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${tab === id ? "bg-white shadow-sm text-transit-600" : "text-ink-400"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "basic" && (
            <div className="space-y-4">
              <Toggle label="啟用小助理" hint="關閉後前台不顯示威洛，公開的回覆 API 也會拒絕請求。" checked={draft.enabled} onChange={(v) => set("enabled", v)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="小助理名稱（中文）"><input className={inputCls} maxLength={30} value={draft.nameZh} onChange={(e) => set("nameZh", e.target.value)} /></Field>
                <Field label="Assistant name (English)"><input className={inputCls} maxLength={30} value={draft.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>
              </div>
              <Field label="初次開啟的歡迎訊息（中文）"><textarea className={inputCls} rows={3} maxLength={500} value={draft.welcomeZh} onChange={(e) => set("welcomeZh", e.target.value)} /></Field>
              <Field label="Welcome message (English)"><textarea className={inputCls} rows={3} maxLength={500} value={draft.welcomeEn} onChange={(e) => set("welcomeEn", e.target.value)} /></Field>
              <Field label="預設語言">
                <select className={inputCls} value={draft.defaultLang} onChange={(e) => set("defaultLang", e.target.value as AssistantLang)}>
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="允許使用者切換語言" checked={draft.allowLangSwitch} onChange={(v) => set("allowLangSwitch", v)} />
                <Toggle label="顯示角色名稱" hint="關閉後標題只顯示「AI 助理」" checked={draft.showName} onChange={(v) => set("showName", v)} />
                <Toggle label="顯示打字中的動畫" checked={draft.showTyping} onChange={(v) => set("showTyping", v)} />
                <Toggle label="關閉對話框後保留聊天紀錄" hint="僅限當次瀏覽期間（分頁關閉就清除）" checked={draft.keepHistory} onChange={(v) => set("keepHistory", v)} />
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-5">
              <section className="space-y-2">
                <h2 className="text-sm font-bold">威洛角色圖片</h2>
                <p className="text-xs text-ink-400">
                  {draft.imageUrl ? "目前使用自訂圖片（只影響小助理）。" : "目前沿用首頁威洛的完整角色圖片（預設）。"}
                </p>
                <ImageUploader label="上傳小助理專用圖片" value={draft.imageUrl} showRemove={false} onChange={(url) => set("imageUrl", url)} />
                {draft.imageUrl && (
                  <button type="button" className="text-xs font-semibold text-transit-600 underline" onClick={() => set("imageUrl", "")}>
                    改回沿用首頁威洛
                  </button>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-bold">動作圖片</h2>
                <p className="text-xs text-ink-400">
                  依威洛實際的回應狀態切換：思考中（等待回應）、生活資訊回答中（回答交通／飲食／日常／校園／文化類問題）、暫時無法解決（沒有任何規則命中、錯誤或逾時）。
                  沒有上傳時，會用內建圖；沒有內建圖就用上面的待機威洛，不會破圖或空白。按「儲存設定」後才會套用到前台；更換或移除的舊圖會移到 uploads\_trash，不會永久刪除。
                </p>
                {(
                  [
                    ["thinking", "thinkingImageUrl", "思考中圖片"],
                    ["life_info", "lifeInfoImageUrl", "生活資訊回答圖片"],
                    ["unresolved", "unresolvedImageUrl", "暫時無法解決圖片"],
                  ] as [AvatarState, "thinkingImageUrl" | "lifeInfoImageUrl" | "unresolvedImageUrl", string][]
                ).map(([state, field, label]) => {
                  const using = resolveStateImage(draft, state);
                  const sourceText = using.source === "custom" ? "目前使用：後台上傳的圖片" : using.source === "bundled" ? "目前使用：內建動作圖" : "目前使用：待機威洛（尚未設定圖片）";
                  return (
                    <div key={field} className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">
                          {label}
                          <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-normal text-ink-500 dark:bg-white/10">狀態：{AVATAR_STATE_LABEL[state]}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewState(previewState === state ? null : state)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${previewState === state ? "border-transit-500 bg-transit-500 text-white" : "border-ink-100"}`}
                        >
                          {previewState === state ? "停止預覽" : "在右側預覽這個動作"}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-ink-400">{sourceText}</p>
                      <div className="mt-2">
                        <ImageUploader label="上傳／更換圖片" fit="contain" value={using.src} showRemove={false} onChange={(url) => set(field, url)} />
                      </div>
                      {draft[field] && (
                        <button type="button" className="mt-1 text-xs font-semibold text-transit-600 underline" onClick={() => set(field, "")}>
                          移除上傳的圖片（改用內建圖／待機威洛）
                        </button>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-ink-400">建議使用背景透明的 PNG，比例和待機威洛相近（約 1380×997）；圖片會完整顯示（不裁切、不拉伸），切換時小助理不會移位或變大變小。</p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <NumberField label="桌面版威洛寬度" value={draft.sizeDesktop} min={60} max={300} onChange={(v) => set("sizeDesktop", v)} />
                <NumberField label="手機版威洛寬度" value={draft.sizeMobile} min={48} max={200} onChange={(v) => set("sizeMobile", v)} />
                <Field label="初始位置">
                  <select className={inputCls} value={draft.position} onChange={(e) => set("position", e.target.value as AssistantSettings["position"])}>
                    <option value="bottom-right">右下</option>
                    <option value="bottom-left">左下</option>
                    <option value="top-right">右上</option>
                    <option value="top-left">左上</option>
                  </select>
                </Field>
                <NumberField label="與螢幕邊緣的距離" value={draft.edgeDistance} min={0} max={200} onChange={(v) => set("edgeDistance", v)} />
                <NumberField label="對話框寬度" value={draft.panelWidth} min={260} max={560} onChange={(v) => set("panelWidth", v)} />
                <NumberField label="對話框高度" value={draft.panelHeight} min={300} max={800} onChange={(v) => set("panelHeight", v)} />
                <NumberField label="對話框圓角" value={draft.panelRadius} min={0} max={40} onChange={(v) => set("panelRadius", v)} />
                <Field label="發送按鈕樣式">
                  <select className={inputCls} value={draft.buttonStyle} onChange={(e) => set("buttonStyle", e.target.value as AssistantSettings["buttonStyle"])}>
                    <option value="round">圓形圖示</option>
                    <option value="square">圓角方形圖示</option>
                    <option value="pill">膠囊（含文字）</option>
                  </select>
                </Field>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <ColorField label="主色（標題列、邊框）" value={draft.primaryColor} onChange={(v) => set("primaryColor", v)} />
                <ColorField label="輔色（按鈕、使用者訊息）" value={draft.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
                <ColorField label="對話框背景色" value={draft.bgColor} onChange={(v) => set("bgColor", v)} />
                <ColorField label="文字顏色" value={draft.textColor} onChange={(v) => set("textColor", v)} />
              </section>

              <section className="grid gap-2 sm:grid-cols-2">
                <Toggle label="顯示陰影" checked={draft.showShadow} onChange={(v) => set("showShadow", v)} />
                <Toggle label="允許使用者拖曳威洛" checked={draft.allowDrag} onChange={(v) => set("allowDrag", v)} />
                <Toggle label="顯示語言切換按鈕" hint="需同時開啟「允許使用者切換語言」" checked={draft.showLangButton} onChange={(v) => set("showLangButton", v)} />
              </section>
            </div>
          )}

          {tab === "rules" && (
            <div className="space-y-4">
              <p className="text-xs text-ink-400">
                由上而下依序比對，<b>第一個命中的規則</b>就回覆（用 ↑↓ 調整優先順序）。關鍵字用逗號或換行分隔，中英文可混合；英文不分大小寫。
              </p>
              {rules.length === 0 && <p className="rounded-lg border border-dashed border-ink-100 p-4 text-center text-sm text-ink-400">目前沒有任何規則，所有問題都會顯示預設回覆。</p>}
              {rules.map((r, i) => (
                <div key={r.id} className={`space-y-2 rounded-xl border p-3 ${r.enabled ? "border-ink-100" : "border-dashed border-ink-100 opacity-60"}`} data-testid="rule-card">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-transit-500/15 px-2 py-0.5 text-xs font-bold text-transit-600">優先 {i + 1}</span>
                    <label className="ml-auto flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} /> 啟用
                    </label>
                    <button type="button" aria-label="上移" disabled={i === 0} onClick={() => moveRule(i, -1)} className="rounded p-1 hover:bg-ink-100 disabled:opacity-30"><ArrowUp size={15} /></button>
                    <button type="button" aria-label="下移" disabled={i === rules.length - 1} onClick={() => moveRule(i, 1)} className="rounded p-1 hover:bg-ink-100 disabled:opacity-30"><ArrowDown size={15} /></button>
                    <button
                      type="button"
                      aria-label="刪除規則"
                      onClick={() => window.confirm("確定刪除這條規則？") && setRules((rs) => rs.filter((x) => x.id !== r.id))}
                      className="rounded p-1 text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <Field label="關鍵字（逗號或換行分隔）"><textarea className={inputCls} rows={2} maxLength={500} value={r.keywords} onChange={(e) => updateRule(r.id, { keywords: e.target.value })} /></Field>
                  <Field label="中文回覆"><textarea className={inputCls} rows={2} maxLength={1000} value={r.replyZh} onChange={(e) => updateRule(r.id, { replyZh: e.target.value })} /></Field>
                  <Field label="English reply"><textarea className={inputCls} rows={2} maxLength={1000} value={r.replyEn} onChange={(e) => updateRule(r.id, { replyEn: e.target.value })} /></Field>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRules((rs) => [...rs, { id: newId(), keywords: "", replyZh: "", replyEn: "", enabled: true, priority: (rs.length + 1) * 10 }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-transit-500 px-3 py-2 text-sm font-semibold text-transit-600"
              >
                <Plus size={15} /> 新增規則
              </button>
              {rules.some((r) => !r.keywords.trim()) && <p className="text-xs text-amber-700">沒有填關鍵字的規則在儲存時會被忽略。</p>}

              <div className="grid gap-3 border-t border-ink-100 pt-4">
                <h2 className="text-sm font-bold">預設回覆（沒有任何規則命中時）</h2>
                <Field label="預設中文回覆"><textarea className={inputCls} rows={2} maxLength={500} value={draft.fallbackZh} onChange={(e) => set("fallbackZh", e.target.value)} /></Field>
                <Field label="Default English reply"><textarea className={inputCls} rows={2} maxLength={500} value={draft.fallbackEn} onChange={(e) => set("fallbackEn", e.target.value)} /></Field>
              </div>

              <div className="space-y-2 rounded-xl bg-ink-100/40 p-3">
                <h2 className="text-sm font-bold">快速測試（使用目前編輯中的規則，不需儲存）</h2>
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="輸入一句話看會回覆什麼" value={testText} onChange={(e) => setTestText(e.target.value)} aria-label="測試輸入" />
                  <select className={`${inputCls} w-28`} value={testLang} onChange={(e) => setTestLang(e.target.value as AssistantLang)} aria-label="測試語言">
                    <option value="zh-TW">中文</option>
                    <option value="en">English</option>
                  </select>
                </div>
                {testReply && <p className="rounded-lg bg-white px-3 py-2 text-sm" data-testid="rule-test-reply">{testReply}</p>}
              </div>
            </div>
          )}
        </div>

        {/* ── 右：預覽 ─────────────────────────────── */}
        <div ref={previewRef} className="xl:sticky xl:top-16 xl:self-start">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <div className="flex overflow-hidden rounded-lg border border-ink-100" role="group" aria-label="預覽裝置">
              {(
                [
                  ["desktop", "桌面版"],
                  ["mobile", "手機版"],
                ] as [PreviewDevice, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={device === id} onClick={() => setDevice(id)} className={`px-3 py-1.5 font-semibold ${device === id ? "bg-transit-500 text-white" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-ink-100" role="group" aria-label="預覽語言">
              {(
                [
                  ["zh-TW", "中文介面"],
                  ["en", "English UI"],
                ] as [AssistantLang, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={previewLang === id} onClick={() => setPreviewLang(id)} className={`px-3 py-1.5 font-semibold ${previewLang === id ? "bg-transit-500 text-white" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setChatOpen((o) => !o)} className="rounded-lg border border-ink-100 px-3 py-1.5 font-semibold">
              {chatOpen ? "收起聊天視窗" : "展開聊天視窗"}
            </button>
          </div>
          {!draft.enabled && <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">目前為「停用」狀態：前台不會顯示小助理（這裡僅供預覽外觀）。</p>}
          <AssistantPreview settings={draft} rules={orderedRules} device={device} lang={previewLang} onLangChange={setPreviewLang} chatOpen={chatOpen} onChatOpenChange={setChatOpen} forcedState={previewState} />
          <p className="mt-2 text-[11px] text-ink-400">預覽以真實尺寸（桌面 1024×640、手機 375×667）縮小顯示；可以在預覽裡點威洛、輸入問題測試。</p>
        </div>
      </div>
    </div>
  );
}
