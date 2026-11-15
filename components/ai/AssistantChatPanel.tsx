"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import type { AssistantLang, AssistantSettings, ChatMessage } from "@/lib/ai/types";
import { assistantStrings, assistantTitle } from "@/lib/ai/i18n";
import { resolveAssistantImage } from "./assistantImage";
import CandidateList from "./CandidateList";
import QuestionForm from "./QuestionForm";
import type { SearchCandidate } from "@/lib/ai/search/respond";
import type { SubmitQuestionPayload } from "@/lib/ai/assistantService";

/** 純 UI：只負責顯示訊息與收集輸入，不知道回覆從哪裡來。前台與後台預覽共用。 */
export default function AssistantChatPanel({
  settings,
  lang,
  onLangChange,
  messages,
  thinking,
  onSend,
  onClose,
  style,
  positioning = "fixed",
  autoFocus = true,
  onPickCandidate,
  onNavigate,
  onSubmitQuestion,
}: {
  settings: AssistantSettings;
  lang: AssistantLang;
  onLangChange: (lang: AssistantLang) => void;
  messages: ChatMessage[];
  thinking: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  style: React.CSSProperties;
  /** 前台用 fixed；後台預覽框內用 absolute */
  positioning?: "fixed" | "absolute";
  autoFocus?: boolean;
  /** 選了候選項目的「看詳細」；沒有提供就不顯示該按鈕（後台預覽） */
  onPickCandidate?: (c: SearchCandidate, m: ChatMessage) => void;
  /** 點了站內連結後（手機版會收起對話框） */
  onNavigate?: () => void;
  /** 提交問題；沒有提供就不顯示「提交問題」提示（後台預覽） */
  onSubmitQuestion?: (p: SubmitQuestionPayload) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [draft, setDraft] = useState("");
  const [formFor, setFormFor] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const s = assistantStrings(lang);
  const name = lang === "en" ? settings.nameEn : settings.nameZh;
  const title = assistantTitle(lang, name, settings.showName);
  const img = resolveAssistantImage(settings);
  const showLang = settings.allowLangSwitch && settings.showLangButton;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, thinking, formFor]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");
    onSend(text);
  }

  const btnShape =
    settings.buttonStyle === "square" ? "rounded-lg h-9 w-9" : settings.buttonStyle === "pill" ? "rounded-full h-9 px-4" : "rounded-full h-9 w-9";

  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        ...style,
        background: settings.bgColor,
        color: settings.textColor,
        borderRadius: settings.panelRadius,
        borderColor: `${settings.primaryColor}66`,
        boxShadow: settings.showShadow ? "0 10px 30px rgba(0,0,0,0.18)" : "none",
      }}
      className={`${positioning} z-[1000] flex flex-col overflow-hidden border`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 text-white" style={{ background: settings.primaryColor }}>
        {settings.showName && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} alt="" draggable={false} className="h-8 w-auto select-none rounded-lg bg-white/90 p-0.5" />
        )}
        <h2 className="flex-1 truncate text-sm font-bold">{title}</h2>
        {showLang && (
          <div role="group" aria-label={s.langLabel} className="flex overflow-hidden rounded-full border border-white/70 text-xs font-semibold">
            {(["zh-TW", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLangChange(code)}
                aria-pressed={lang === code}
                className="px-2 py-1 transition-colors"
                style={lang === code ? { background: "#fff", color: settings.secondaryColor } : undefined}
              >
                {code === "en" ? s.english : s.chinese}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={s.close}
          title={s.close}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/25"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" style={{ background: `${settings.primaryColor}12` }} aria-live="polite">
        {messages.map((m) => (
          <div key={m.id}>
            <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[85%] whitespace-pre-line break-words px-3 py-2 text-sm leading-relaxed " +
                  (m.role === "user" ? "rounded-2xl rounded-br-sm text-white" : "rounded-2xl rounded-bl-sm border")
                }
                style={
                  m.role === "user"
                    ? { background: settings.secondaryColor }
                    : { background: settings.bgColor, borderColor: `${settings.primaryColor}66` }
                }
              >
                {m.text}
              </div>
            </div>
            {m.role === "assistant" && ((m.candidates?.length ?? 0) > 0 || (m.suggestions?.length ?? 0) > 0) && (
              <CandidateList message={m} settings={settings} lang={lang} onPick={onPickCandidate} onNavigate={onNavigate} />
            )}
            {m.role === "assistant" && m.asked && onSubmitQuestion && (
              <div className="mt-1.5">
                {formFor === m.id ? (
                  <QuestionForm
                    settings={settings}
                    lang={lang}
                    initialQuestion={m.asked}
                    context={{ question: m.asked, candidates: (m.candidates ?? []).map((c) => ({ title: c.title, category: c.category })) }}
                    onSubmit={onSubmitQuestion}
                    onCancel={() => setFormFor(null)}
                  />
                ) : (
                  <p className="text-xs opacity-70">
                    {s.askNotFound}{" "}
                    <button type="button" onClick={() => setFormFor(m.id)} className="font-semibold underline" style={{ color: settings.secondaryColor }}>
                      {s.askSubmit}
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {thinking && settings.showTyping && (
          <div className="flex justify-start">
            <div
              className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border px-3 py-2 text-sm opacity-80"
              style={{ background: settings.bgColor, borderColor: `${settings.primaryColor}66` }}
            >
              <span className="flex gap-0.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full"
                    style={{ background: settings.secondaryColor, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              {s.findingHelp}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t p-2.5" style={{ borderColor: `${settings.primaryColor}33`, background: settings.bgColor }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={s.placeholder}
          maxLength={300}
          className="min-w-0 flex-1 rounded-full border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: `${settings.primaryColor}99`, color: settings.textColor }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || thinking}
          aria-label={s.send}
          title={s.send}
          className={`flex shrink-0 items-center justify-center gap-1 text-sm font-semibold text-white disabled:opacity-40 ${btnShape}`}
          style={{ background: settings.secondaryColor }}
        >
          <Send size={16} />
          {settings.buttonStyle === "pill" && <span>{s.send}</span>}
        </button>
      </form>
    </div>
  );
}
