"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusBanner, { StatusMessage } from "@/components/admin/StatusBanner";
import { buildDocs, KNOWLEDGE_CATEGORY_LABEL } from "@/lib/ai/search/docs";
import { search } from "@/lib/ai/search/engine";
import { toCandidate } from "@/lib/ai/search/respond";
import { QUESTION_CATEGORIES, QUESTION_CATEGORY_LABEL, QUESTION_STATUSES, QUESTION_STATUS_LABEL, type QuestionStatus } from "@/lib/ai/questions";

type Knowledge = {
  id: string;
  questionId: string | null;
  standardQuestion: string;
  questionEn: string;
  answerZh: string;
  answerEn: string;
  synonyms: string;
  category: string;
  sourceUrl: string;
  status: "draft" | "approved";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type Question = {
  id: string;
  question: string;
  category: string;
  note: string;
  lang: string;
  contextQuestion: string;
  contextCandidates: string;
  status: QuestionStatus;
  standardQuestion: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  knowledge: Pick<Knowledge, "id" | "status" | "isActive"> | Knowledge | null;
};

const inputCls = "w-full rounded-lg border border-ink-100 dark:border-ink-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-transit-500";
const fmt = (iso: string) => new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
const statusColor: Record<QuestionStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  organizing: "bg-sky-500/15 text-sky-700",
  knowledge_created: "bg-green-500/15 text-green-700",
  rejected: "bg-ink-100 text-ink-500",
};

function parseCandidates(s: string): { title: string; category: string }[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function QuestionsAdmin() {
  const [tab, setTab] = useState<"questions" | "knowledge">("questions");
  const [status, setStatus] = useState<StatusMessage>(null);
  const [filters, setFilters] = useState({ status: "", category: "", from: "", to: "", order: "new" });
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ total: number; questions: Question[]; pageSize: number } | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<Knowledge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Question | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ ...filters, page: String(page) });
    const res = await fetch(`/api/admin/assistant/questions?${q}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setList(data);
      setStatus(null);
    } else setStatus({ type: "error", text: data.error || "讀取失敗。" });
    setLoading(false);
  }, [filters, page]);

  const loadKnowledge = useCallback(async () => {
    const res = await fetch("/api/admin/assistant/knowledge");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setKnowledgeList(data.knowledge);
    else setStatus({ type: "error", text: data.error || "讀取失敗。" });
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);
  useEffect(() => {
    if (tab === "knowledge") loadKnowledge();
  }, [tab, loadKnowledge]);

  async function open(id: string) {
    const res = await fetch(`/api/admin/assistant/questions/${id}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSelected(data.question);
    else setStatus({ type: "error", text: data.error || "讀取失敗。" });
  }

  function onSaved(q: Question) {
    setSelected(q);
    loadList();
    if (tab === "knowledge") loadKnowledge();
  }

  const setF = (k: keyof typeof filters, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">🙋 威洛問題求助</h1>
          <p className="mt-1 text-sm text-ink-400">
            使用者提交的問題先放在這裡（未審核，<b>不會</b>被威洛搜尋到）。你整理成標準問題與正式答案、按「核准並啟用」後，威洛才會用搜尋演算法找到它。這不是即時客服，也不是威洛自動學習。
          </p>
        </div>
        <Link href="/admin/assistant" className="rounded-lg border border-ink-100 px-3 py-2 text-sm">← 威洛小助理設定</Link>
      </div>

      <div className="mt-4 flex gap-1 rounded-lg bg-ink-100/60 p-1 text-sm" role="tablist">
        {([["questions", "使用者投稿"], ["knowledge", "已建立的知識"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${tab === id ? "bg-white text-transit-600 shadow-sm" : "text-ink-400"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4"><StatusBanner status={status} /></div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          {tab === "questions" ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <select className={inputCls} value={filters.status} onChange={(e) => setF("status", e.target.value)} aria-label="處理狀態">
                  <option value="">全部狀態</option>
                  {QUESTION_STATUSES.map((s) => <option key={s} value={s}>{QUESTION_STATUS_LABEL[s]}</option>)}
                </select>
                <select className={inputCls} value={filters.category} onChange={(e) => setF("category", e.target.value)} aria-label="問題分類">
                  <option value="">全部分類</option>
                  <option value="none">未選分類</option>
                  {QUESTION_CATEGORIES.map((c) => <option key={c} value={c}>{QUESTION_CATEGORY_LABEL[c]}</option>)}
                </select>
                <input type="date" className={inputCls} value={filters.from} onChange={(e) => setF("from", e.target.value)} aria-label="提交日期起" />
                <input type="date" className={inputCls} value={filters.to} onChange={(e) => setF("to", e.target.value)} aria-label="提交日期迄" />
                <select className={inputCls} value={filters.order} onChange={(e) => setF("order", e.target.value)} aria-label="排序">
                  <option value="new">最新在前</option>
                  <option value="old">最舊在前</option>
                </select>
              </div>
              {loading && !list ? (
                <p className="mt-4 text-sm text-ink-400">載入中…</p>
              ) : (
                <ul className="mt-3 divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100 dark:divide-ink-800 dark:border-ink-800">
                  {(list?.questions ?? []).map((q) => (
                    <li key={q.id}>
                      <button type="button" onClick={() => open(q.id)} className={`block w-full px-3 py-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-white/5 ${selected?.id === q.id ? "bg-transit-500/10" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor[q.status]}`}>{QUESTION_STATUS_LABEL[q.status]}</span>
                          {q.category && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">{QUESTION_CATEGORY_LABEL[q.category as keyof typeof QUESTION_CATEGORY_LABEL] ?? q.category}</span>}
                          {q.knowledge && <span className="text-xs text-ink-400">{q.knowledge.isActive ? "知識啟用中" : q.knowledge.status === "draft" ? "知識草稿" : "知識已停用"}</span>}
                          <span className="ml-auto text-xs text-ink-400">{fmt(q.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 break-words">{q.question}</p>
                      </button>
                    </li>
                  ))}
                  {(list?.questions.length ?? 0) === 0 && <li className="p-6 text-center text-sm text-ink-400">沒有符合條件的投稿。</li>}
                </ul>
              )}
              {list && list.total > list.pageSize && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-ink-100 px-3 py-1 disabled:opacity-40">上一頁</button>
                  <span className="text-ink-400">第 {page} 頁／共 {Math.ceil(list.total / list.pageSize)} 頁（{list.total} 筆）</span>
                  <button disabled={page * list.pageSize >= list.total} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-ink-100 px-3 py-1 disabled:opacity-40">下一頁</button>
                </div>
              )}
            </>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100 dark:divide-ink-800 dark:border-ink-800">
              {(knowledgeList ?? []).map((k) => (
                <li key={k.id}>
                  <button type="button" disabled={!k.questionId} onClick={() => k.questionId && open(k.questionId)} className="block w-full px-3 py-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-white/5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${k.isActive ? "bg-green-500/15 text-green-700" : "bg-ink-100 text-ink-500"}`}>{k.isActive ? "啟用中" : k.status === "draft" ? "草稿" : "已停用"}</span>
                      <span className="text-xs text-ink-400">{KNOWLEDGE_CATEGORY_LABEL[k.category]?.zh ?? k.category}</span>
                      <span className="ml-auto text-xs text-ink-400">更新 {fmt(k.updatedAt)}</span>
                    </div>
                    <p className="mt-1 break-words font-semibold">{k.standardQuestion}</p>
                  </button>
                </li>
              ))}
              {knowledgeList && knowledgeList.length === 0 && <li className="p-6 text-center text-sm text-ink-400">還沒有建立任何知識。</li>}
            </ul>
          )}
        </div>

        <div>
          {selected ? <QuestionEditor key={selected.id + selected.updatedAt} q={selected} onSaved={onSaved} setStatus={setStatus} /> : <p className="rounded-xl border border-dashed border-ink-100 p-8 text-center text-sm text-ink-400">點左邊的一筆投稿，在這裡查看與整理。</p>}
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({ q, onSaved, setStatus }: { q: Question; onSaved: (q: Question) => void; setStatus: (s: StatusMessage) => void }) {
  const k = q.knowledge && "answerZh" in q.knowledge ? (q.knowledge as Knowledge) : null;
  const [f, setF] = useState({
    standardQuestion: k?.standardQuestion || q.standardQuestion || q.question,
    questionEn: k?.questionEn ?? "",
    answerZh: k?.answerZh ?? "",
    answerEn: k?.answerEn ?? "",
    synonyms: k?.synonyms ?? "",
    category: k?.category || (q.category && q.category in KNOWLEDGE_CATEGORY_LABEL ? q.category : "other"),
    sourceUrl: k?.sourceUrl ?? "",
    adminNote: q.adminNote,
    status: q.status,
  });
  const [busy, setBusy] = useState(false);
  const [testQ, setTestQ] = useState("");
  const cands = parseCandidates(q.contextCandidates);
  const set = <K extends keyof typeof f>(key: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [key]: v }));

  async function call(url: string, method: "PATCH" | "PUT", body: unknown, okText: string) {
    setBusy(true);
    setStatus(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus({ type: "error", text: data.error || "儲存失敗。" });
      return;
    }
    setStatus({ type: "success", text: okText });
    const r = await fetch(`/api/admin/assistant/questions/${q.id}`);
    const d = await r.json().catch(() => ({}));
    if (r.ok) onSaved(d.question);
  }

  const knowledgeBody = (action: string) => ({ action, standardQuestion: f.standardQuestion, questionEn: f.questionEn, answerZh: f.answerZh, answerEn: f.answerEn, synonyms: f.synonyms, category: f.category, sourceUrl: f.sourceUrl });
  const saveOrganize = () => call(`/api/admin/assistant/questions/${q.id}`, "PATCH", { standardQuestion: f.standardQuestion, adminNote: f.adminNote, ...(f.status !== "knowledge_created" ? { status: f.status } : {}) }, "已儲存整理內容。");

  // 預覽：用和前台完全相同的搜尋與卡片流程，看這筆知識會怎麼被威洛呈現
  const preview = useMemo(() => {
    const docs = buildDocs({
      life: [], campus: [], events: [], stages: [], rules: [],
      knowledge: [{ id: "preview", question: f.standardQuestion, questionEn: f.questionEn, answerZh: f.answerZh, answerEn: f.answerEn, synonyms: f.synonyms, category: f.category, sourceUrl: f.sourceUrl || null }],
    });
    const query = testQ.trim() || f.standardQuestion;
    const out = search(query, docs);
    const hit = out.results[0];
    return { query, hit, card: hit ? toCandidate(hit, query, "zh-TW") : null, doc: docs[0]! };
  }, [f, testQ]);

  const active = k?.isActive;
  return (
    <div className="space-y-4 rounded-xl border border-ink-100 p-4 dark:border-ink-800">
      <section>
        <h2 className="text-sm font-bold">使用者的原始投稿（不可修改）</h2>
        <p className="mt-1 whitespace-pre-line break-words rounded-lg bg-ink-50 p-3 text-sm dark:bg-white/5">{q.question}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-500">
          <dt>提交時間</dt><dd>{fmt(q.createdAt)}</dd>
          <dt>分類</dt><dd>{q.category ? QUESTION_CATEGORY_LABEL[q.category as keyof typeof QUESTION_CATEGORY_LABEL] ?? q.category : "（未選）"}</dd>
          <dt>語言</dt><dd>{q.lang}</dd>
        </dl>
        {q.note && <p className="mt-2 whitespace-pre-line break-words text-sm"><b>補充說明：</b>{q.note}</p>}
        {(q.contextQuestion || cands.length > 0) && (
          <div className="mt-2 rounded-lg border border-ink-100 p-2 text-xs dark:border-ink-800">
            <p><b>當時的提問：</b>{q.contextQuestion || "—"}</p>
            {cands.length > 0 && <p className="mt-1"><b>威洛當時提供的候選：</b>{cands.map((c) => `${c.title}（${c.category}）`).join("、")}</p>}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">整理與正式知識</h2>
        <label className="block text-sm">處理狀態
          <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value as QuestionStatus)} disabled={f.status === "knowledge_created"}>
            {QUESTION_STATUSES.map((s) => <option key={s} value={s} disabled={s === "knowledge_created"}>{QUESTION_STATUS_LABEL[s]}</option>)}
          </select>
          {f.status === "knowledge_created" && <span className="text-xs text-ink-400">已建立知識；要改狀態請先停用知識，或標為「暫不採用」會一併停用。</span>}
        </label>
        <label className="block text-sm">標準問題（整理成清楚的問法）
          <input className={inputCls} value={f.standardQuestion} maxLength={300} onChange={(e) => set("standardQuestion", e.target.value)} />
        </label>
        <label className="block text-sm">標準問題（English，選填）
          <input className={inputCls} value={f.questionEn} maxLength={300} onChange={(e) => set("questionEn", e.target.value)} />
        </label>
        <label className="block text-sm">正式答案（中文）
          <textarea className={inputCls} rows={4} value={f.answerZh} maxLength={3000} onChange={(e) => set("answerZh", e.target.value)} />
        </label>
        <label className="block text-sm">正式答案（English，選填；沒填英文版時會顯示中文）
          <textarea className={inputCls} rows={3} value={f.answerEn} maxLength={3000} onChange={(e) => set("answerEn", e.target.value)} />
        </label>
        <label className="block text-sm">同義問法／相關搜尋詞（選填，換行或逗號分隔；不填也能被搜尋，標準問題與答案文字都會參與比對）
          <textarea className={inputCls} rows={2} value={f.synonyms} maxLength={1000} onChange={(e) => set("synonyms", e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">相關分類
            <select className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(KNOWLEDGE_CATEGORY_LABEL).map(([id, l]) => <option key={id} value={id}>{l.zh}</option>)}
            </select>
          </label>
          <label className="block text-sm">相關網站頁面／資料來源連結（選填）
            <input className={inputCls} placeholder="/life/bus 或 https://…" value={f.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">內部備註（只有管理員看得到）
          <textarea className={inputCls} rows={2} value={f.adminNote} maxLength={1000} onChange={(e) => set("adminNote", e.target.value)} />
        </label>
      </section>

      <section className="rounded-lg bg-ink-50 p-3 dark:bg-white/5">
        <h3 className="text-sm font-bold">預覽：威洛搜尋到這筆知識時的樣子</h3>
        <label className="mt-2 block text-xs">試試別的問法（空白＝用標準問題）
          <input className={inputCls} value={testQ} onChange={(e) => setTestQ(e.target.value)} placeholder="例如：換一種說法問同一件事" />
        </label>
        {preview.card ? (
          <div className="mt-2 rounded-xl border border-transit-500/40 bg-white p-3 text-sm dark:bg-black/20">
            <div className="flex flex-wrap items-center gap-2"><b>{preview.card.title || "（尚未填標準問題）"}</b><span className="rounded-full bg-transit-500/15 px-2 py-0.5 text-xs">{preview.card.category}</span></div>
            <p className="mt-1 whitespace-pre-line break-words">{preview.card.summary || "（尚未填答案）"}</p>
            {preview.card.url && <p className="mt-1 text-xs text-transit-600 underline">前往查看：{preview.card.url}</p>}
            <p className="mt-1 text-xs text-ink-400">用「{preview.query}」搜尋時有找到這筆。</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-500">用「{preview.query}」搜尋時，找不到這筆知識（可補同義問法，或讓標準問題／答案更貼近這個問法）。</p>
        )}
        <p className="mt-2 text-xs text-ink-400">目前狀態：{!k ? "尚未建立知識" : active ? "已核准並啟用（威洛搜尋得到）" : k.status === "draft" ? "草稿（威洛搜尋不到）" : "已停用（威洛搜尋不到）"}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={saveOrganize} className="rounded-lg border border-ink-100 px-3 py-2 text-sm font-semibold disabled:opacity-50">儲存整理內容</button>
        <button disabled={busy} onClick={() => call(`/api/admin/assistant/questions/${q.id}/knowledge`, "PUT", knowledgeBody("draft"), "已儲存草稿（尚未啟用）。")} className="rounded-lg border border-transit-500 px-3 py-2 text-sm font-semibold text-transit-600 disabled:opacity-50">儲存知識草稿</button>
        <button disabled={busy} onClick={() => call(`/api/admin/assistant/questions/${q.id}/knowledge`, "PUT", knowledgeBody("approve"), "已核准並啟用，威洛現在搜尋得到這筆知識。")} className="rounded-lg bg-lantern-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{k?.status === "approved" ? "更新並啟用" : "核准並啟用"}</button>
        {k && k.status === "approved" && (
          <button disabled={busy} onClick={() => call(`/api/admin/assistant/questions/${q.id}/knowledge`, "PUT", { action: active ? "disable" : "enable" }, active ? "已停用，威洛不會再搜尋到這筆知識。" : "已重新啟用。")} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">{active ? "停用知識" : "重新啟用"}</button>
        )}
      </div>
    </div>
  );
}
