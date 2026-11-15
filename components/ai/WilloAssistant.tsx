"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage, STORAGE_KEY as SITE_LANG_KEY } from "@/context/LanguageContext";
import { askAssistantDetailed, AssistantDisabledError, fetchCandidateDetail, submitQuestion } from "@/lib/ai/assistantService";
import { topicForCandidate, type SearchCandidate } from "@/lib/ai/search/respond";
import { AVATAR_HOLD_MS, REPLY_TIMEOUT_MS, outcomeFromError, resolveAvatarState, type ReplyOutcome } from "@/lib/ai/avatarState";
import { assistantStrings } from "@/lib/ai/i18n";
import type { AssistantLang, AssistantPublicConfig, ChatMessage } from "@/lib/ai/types";
import AssistantChatPanel from "./AssistantChatPanel";
import WilloAvatar from "./WilloAvatar";
import { computePanelStyle } from "./placement";
import { useDraggable } from "./useDraggable";

const MSG_KEY = "willo-assistant-messages";
const POS_KEY = "willo-assistant-pos";

function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeSession(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage 不可用時忽略 */
  }
}
/** 超過時間沒回應就丟出逾時錯誤（頭像會切到「暫時無法解決」）。 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("assistant_timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * 全站漂浮的威洛 AI 助理。掛在 SiteChrome（共用 layout），換頁不會消失、狀態不會重置。
 * 所有外觀與文字都來自後台設定（config.settings）；停用時 SiteChrome 根本不會渲染它。
 */
export default function WilloAssistant({ config }: { config: AssistantPublicConfig }) {
  const { settings, version } = config;
  const [open, setOpen] = useState(false);
  // 語言與「全站語言」連動：訪客在網站上選過語言（右上角切換）就跟著它；
  // 還沒選過時才用後台設定的「預設語言」。在對話框裡切換語言也會同步切換全站語言。
  const { lang: siteLang, setLang: setSiteLang } = useLanguage();
  const [followSite, setFollowSite] = useState(false);
  const lang: AssistantLang = followSite ? siteLang : settings.defaultLang;
  const makeGreeting = useCallback(
    (l: AssistantLang): ChatMessage => ({
      id: "greeting",
      role: "assistant",
      text: l === "en" ? settings.welcomeEn : settings.welcomeZh,
    }),
    [settings.welcomeEn, settings.welcomeZh]
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "greeting", role: "assistant", text: settings.defaultLang === "en" ? settings.welcomeEn : settings.welcomeZh },
  ]);
  const [thinking, setThinking] = useState(false);
  // 頭像狀態＝「是否等待中」＋「最近一次回覆的結果」，由真正的請求／回應／錯誤驅動（見 lib/ai/avatarState.ts）
  const [outcome, setOutcome] = useState<ReplyOutcome | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [hydrated, setHydrated] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const { ref, pos, dragging, handlers } = useDraggable({
    corner: settings.position,
    edge: settings.edgeDistance,
    enabled: settings.allowDrag,
    storageKey: `${POS_KEY}:${version}`,
    onClick: toggle,
  });

  // 還原同一個瀏覽分頁（session）中的對話
  useEffect(() => {
    let stored = false;
    try {
      stored = !!window.localStorage.getItem(SITE_LANG_KEY);
    } catch {
      /* ignore */
    }
    setFollowSite(stored);
    const l: AssistantLang = stored ? siteLang : settings.defaultLang;
    const saved = settings.keepHistory ? readSession<ChatMessage[]>(`${MSG_KEY}:${version}`) : null;
    // 只有歡迎訊息（還沒有人提問）時不還原，這樣後台改了歡迎訊息會立刻生效
    if (saved && saved.some((m) => m.role === "user")) setMessages(saved);
    else setMessages([makeGreeting(l)]);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // 全站語言改變（例如從導覽列切換）時，尚未提問的歡迎訊息跟著換語言；已有的對話保留原語言
  useEffect(() => {
    if (!hydrated) return;
    setMessages((m) => (m.some((x) => x.role === "user") ? m : [makeGreeting(lang)]));
  }, [lang, hydrated, makeGreeting]);

  useEffect(() => {
    if (hydrated && settings.keepHistory) writeSession(`${MSG_KEY}:${version}`, messages);
  }, [messages, hydrated, settings.keepHistory, version]);

  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  /** 在對話框切換語言：同步切換全站語言；不清空紀錄、不關閉、不動位置（舊訊息保留原語言）。 */
  const changeLang = useCallback(
    (next: AssistantLang) => {
      setFollowSite(true);
      setSiteLang(next);
    },
    [setSiteLang]
  );

  const close = useCallback(() => {
    setOpen(false);
    // 「關閉後不保留紀錄」：回到只有歡迎訊息的狀態
    if (!settings.keepHistory) setMessages([makeGreeting(lang)]);
  }, [settings.keepHistory, makeGreeting, lang]);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  /** 顯示回答／無法解決的動作一段時間，之後回到待機。 */
  const holdOutcome = useCallback((o: ReplyOutcome) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setOutcome(o);
    holdTimer.current = setTimeout(() => setOutcome(null), AVATAR_HOLD_MS);
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      setOutcome(null);
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
      const history = [...messagesRef.current, userMsg];
      setMessages(history);
      setThinking(true);
      const s = assistantStrings(lang);
      try {
        // 真的去搜尋（沒有為了動畫刻意等待）；頭像「思考中」就是這段實際等待時間
        const reply = await withTimeout(askAssistantDetailed(text, lang, history), REPLY_TIMEOUT_MS);
        setMessages((m) => [
          ...m,
          { id: `a-${Date.now()}`, role: "assistant", text: reply.text, candidates: reply.candidates, suggestions: reply.suggestions, moreLabel: reply.moreLabel, asked: text },
        ]);
        // 有規則命中 → 正常回答（生活資訊類顯示生活資訊動作）；沒命中 → 暫時無法解決
        holdOutcome(reply.outcome);
      } catch (err) {
        const msg = err instanceof AssistantDisabledError ? s.disabled : s.error;
        setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", text: msg }]);
        // API 錯誤／逾時／停用：顯示錯誤提示，頭像切到「暫時無法解決」
        holdOutcome(outcomeFromError(err));
      } finally {
        setThinking(false);
      }
    },
    [lang, holdOutcome]
  );

  /** 使用者在候選清單選了某一項：取該筆資料的詳細內容，接在對話後面。 */
  const pickCandidate = useCallback(
    async (c: SearchCandidate, from: ChatMessage) => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      setOutcome(null);
      const st = assistantStrings(lang);
      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text: c.title }]);
      setThinking(true);
      try {
        const d = await withTimeout(fetchCandidateDetail(c.id, lang), REPLY_TIMEOUT_MS);
        if (!d) {
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", text: st.detailGone, asked: from.asked }]);
          holdOutcome({ kind: "unresolved", reason: "empty" });
        } else {
          setMessages((m) => [
            ...m,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              text: `${d.title}\n\n${d.text}`,
              suggestions: d.url ? [{ label: st.openPage, url: d.url }] : [],
              asked: from.asked,
            },
          ]);
          holdOutcome({ kind: "answered", topic: topicForCandidate(c), type: d.type ?? null });
        }
      } catch (err) {
        setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", text: err instanceof AssistantDisabledError ? st.disabled : st.error }]);
        holdOutcome(outcomeFromError(err));
      } finally {
        setThinking(false);
      }
    },
    [lang, holdOutcome]
  );

  /** 手機版點了站內連結後收起對話框（對話紀錄保留在本次瀏覽中）。 */
  const onNavigate = useCallback(() => {
    if (window.innerWidth < 640) setOpen(false);
  }, []);

  // 對話框位置（邏輯見 placement.ts）
  let panelStyle: React.CSSProperties | null = null;
  const el = ref.current;
  if (open && vp.w && el && pos) {
    const rect = el.getBoundingClientRect();
    panelStyle = computePanelStyle(vp, rect, settings);
  }

  const avatarState = resolveAvatarState({ pending: thinking, outcome });
  const anchor: React.CSSProperties = pos
    ? { right: pos.right, bottom: pos.bottom }
    : {
        [settings.position.startsWith("bottom") ? "bottom" : "top"]: settings.edgeDistance,
        [settings.position.endsWith("right") ? "right" : "left"]: settings.edgeDistance,
      };
  const name = lang === "en" ? settings.nameEn : settings.nameZh;
  const s = assistantStrings(lang);

  return (
    <>
      {/* 桌面/手機各自的威洛尺寸（640px 為分界，與網站既有 sm 斷點一致） */}
      <style>{`.willo-float{width:${settings.sizeMobile}px}@media (min-width:640px){.willo-float{width:${settings.sizeDesktop}px}}`}</style>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`${s.openLabel}${settings.showName ? `：${name}` : ""}`}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        {...handlers}
        style={{
          ...anchor,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          visibility: pos ? "visible" : "hidden", // 量到位置前先藏起來，避免閃一下
          filter: settings.showShadow ? "drop-shadow(0 6px 10px rgba(0,0,0,0.25))" : undefined,
        }}
        className={`willo-float fixed z-[999] rounded-xl focus:outline-none focus-visible:ring-2 ${
          settings.allowDrag ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer"
        }`}
      >
        <WilloAvatar settings={settings} state={avatarState} alt={name} customSrc={outcome?.type?.imageUrl} />
        {(() => {
          // 問題類型的簡短狀態文字（後台設定；沒填就不顯示）
          const label = avatarState === "custom" ? (lang === "en" ? outcome?.type?.labelEn || outcome?.type?.labelZh : outcome?.type?.labelZh || outcome?.type?.labelEn) : "";
          return label ? (
            <span data-testid="willo-status-label" className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-medium text-ink-700 shadow">
              {label}
            </span>
          ) : null;
        })()}
      </div>

      {open && panelStyle && (
        <AssistantChatPanel
          settings={settings}
          lang={lang}
          onLangChange={changeLang}
          messages={messages}
          thinking={thinking}
          onSend={send}
          onPickCandidate={pickCandidate}
          onNavigate={onNavigate}
          onSubmitQuestion={submitQuestion}
          onClose={close}
          style={panelStyle}
        />
      )}
    </>
  );
}
