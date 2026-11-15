"use client";

import { useRef, useState } from "react";
import type { AssistantLang, AssistantSettings } from "@/lib/ai/types";
import { assistantStrings } from "@/lib/ai/i18n";
import { LIMITS, QUESTION_CATEGORIES } from "@/lib/ai/questions";
import type { SubmitQuestionPayload } from "@/lib/ai/assistantService";

function newKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * 在威洛聊天視窗裡展開的「提交問題」表單：不跳頁、不關閉小助理、不清除對話。
 * - clientKey 在表單打開時產生一次；失敗後重試用同一個，伺服器就不會重複建立。
 * - 伺服器確認保存成功才顯示成功；失敗時保留已填內容。
 * - 只送必要欄位；上下文（當次提問與候選標題）預設附上、可取消，不會送整段聊天紀錄。
 */
export default function QuestionForm({
  settings,
  lang,
  initialQuestion,
  context,
  onSubmit,
  onCancel,
}: {
  settings: AssistantSettings;
  lang: AssistantLang;
  initialQuestion: string;
  context?: { question: string; candidates: { title: string; category: string }[] };
  onSubmit: (p: SubmitQuestionPayload) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const s = assistantStrings(lang);
  const keyRef = useRef(newKey());
  const [question, setQuestion] = useState(initialQuestion);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [attach, setAttach] = useState(!!context);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [needText, setNeedText] = useState(false);
  const busy = useRef(false); // 防止連點

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || state === "success") return;
    if (!question.trim()) {
      setNeedText(true);
      return;
    }
    setNeedText(false);
    busy.current = true;
    setState("sending");
    const res = await onSubmit({
      clientKey: keyRef.current,
      question: question.trim(),
      category,
      note: note.trim(),
      lang,
      ...(attach && context ? { context } : {}),
    });
    busy.current = false;
    setState(res.ok ? "success" : "error");
  }

  const field = "w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none";
  const fieldStyle = { borderColor: `${settings.primaryColor}99`, color: settings.textColor };

  if (state === "success") {
    return (
      <div role="status" className="mt-2 max-w-[92%] rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: settings.primaryColor, background: `${settings.primaryColor}1f` }}>
        {s.fSuccess}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 max-w-[92%] space-y-2 rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: `${settings.primaryColor}99`, background: settings.bgColor }} data-testid="assistant-question-form">
      <h3 className="font-bold">{s.formTitle}</h3>
      <label className="block">
        <span className="mb-0.5 block text-xs font-semibold">{s.fQuestion}</span>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={LIMITS.question}
          rows={2}
          className={field}
          style={fieldStyle}
          disabled={state === "sending"}
        />
        {needText && <span className="text-xs text-red-500">{s.fRequired}</span>}
      </label>
      <label className="block">
        <span className="mb-0.5 block text-xs font-semibold">{s.fCategory}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={field} style={fieldStyle} disabled={state === "sending"}>
          <option value="">{s.fNoCategory}</option>
          {QUESTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {s.categories[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-0.5 block text-xs font-semibold">{s.fNote}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={LIMITS.note} rows={2} className={field} style={fieldStyle} disabled={state === "sending"} />
      </label>
      {context && (
        <label className="flex items-start gap-1.5 text-xs">
          <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="mt-0.5" disabled={state === "sending"} />
          <span>{s.fContext}</span>
        </label>
      )}
      <p className="text-[11px] opacity-60">{s.fPrivacy}</p>
      {state === "error" && (
        <p role="alert" className="text-xs font-semibold text-red-500">
          {s.fFail}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={state === "sending"} className="rounded-full px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: settings.secondaryColor }}>
          {state === "sending" ? s.fSending : s.fSend}
        </button>
        <button type="button" onClick={onCancel} disabled={state === "sending"} className="rounded-full border px-4 py-1.5 text-sm" style={{ borderColor: `${settings.primaryColor}99` }}>
          {s.fCancel}
        </button>
      </div>
    </form>
  );
}
