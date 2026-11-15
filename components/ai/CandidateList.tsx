"use client";

import Link from "next/link";
import type { AssistantLang, AssistantSettings, ChatMessage } from "@/lib/ai/types";
import type { SearchCandidate } from "@/lib/ai/search/respond";
import { assistantStrings } from "@/lib/ai/i18n";

/** 候選資料卡片＋引導連結。純 UI，點擊「看詳細」由上層處理。 */
export default function CandidateList({
  message,
  settings,
  lang,
  onPick,
  onNavigate,
}: {
  message: ChatMessage;
  settings: AssistantSettings;
  lang: AssistantLang;
  onPick?: (c: SearchCandidate, m: ChatMessage) => void;
  onNavigate?: () => void;
}) {
  const s = assistantStrings(lang);
  const cands = message.candidates ?? [];
  const levelText = (l: SearchCandidate["level"]) => (l === "high" ? s.levelHigh : l === "medium" ? s.levelMid : s.levelLow);
  const border = { borderColor: `${settings.primaryColor}66`, background: settings.bgColor };
  return (
    <div className="mt-1.5 max-w-[92%] space-y-1.5">
      {cands.map((c, i) => (
        <div key={c.id}>
          {i === 1 && message.moreLabel && <p className="mb-1 mt-2 text-xs font-semibold opacity-70">{message.moreLabel}</p>}
          <div className="rounded-xl border px-3 py-2 text-sm" style={border} data-testid="assistant-candidate">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold">{c.title}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${settings.primaryColor}26`, color: settings.secondaryColor }}>
                {c.category}
              </span>
              {c.expanded ? (
                <span className="text-[11px] opacity-60">{s.expanded}</span>
              ) : (
                <span className="text-[11px] opacity-60">
                  {s.relevance}：{levelText(c.level)}
                </span>
              )}
            </div>
            {c.summary && <p className="mt-1 whitespace-pre-line break-words leading-relaxed opacity-90">{c.summary}</p>}
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-semibold">
              {onPick && (
                <button type="button" onClick={() => onPick(c, message)} className="underline" style={{ color: settings.secondaryColor }}>
                  {s.seeDetail}
                </button>
              )}
              {c.url && (c.url.startsWith("/") ? (
                <Link href={c.url} onClick={onNavigate} className="underline" style={{ color: settings.secondaryColor }}>
                  {s.openPage}
                </Link>
              ) : (
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: settings.secondaryColor }}>
                  {s.openPage}
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}
      {(message.suggestions ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.suggestions!.map((l) => (
            <Link
              key={l.url}
              href={l.url}
              onClick={onNavigate}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: settings.primaryColor, color: settings.secondaryColor, background: settings.bgColor }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
