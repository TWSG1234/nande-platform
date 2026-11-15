"use client";

import { useEffect, useRef, useState } from "react";
import AssistantChatPanel from "@/components/ai/AssistantChatPanel";
import { resolveAssistantImage } from "@/components/ai/assistantImage";
import WilloAvatar from "@/components/ai/WilloAvatar";
import { AVATAR_HOLD_MS, resolveAvatarState, type AvatarState, type ReplyOutcome } from "@/lib/ai/avatarState";
import { classifyLifeTopic } from "@/lib/ai/topic";
import { computePanelStyle } from "@/components/ai/placement";
import { matchMockResult } from "@/lib/ai/mockAIResponse";
import type { AssistantLang, AssistantRuleData, AssistantSettings, ChatMessage } from "@/lib/ai/types";

export type PreviewDevice = "desktop" | "mobile";

const FRAMES: Record<PreviewDevice, { w: number; h: number }> = {
  desktop: { w: 1024, h: 640 },
  mobile: { w: 375, h: 667 },
};

/**
 * 後台預覽：用「尚未儲存的草稿」畫出小助理，尺寸用真實像素（桌面 1024×640、手機 375×667）
 * 再整體縮小塞進欄位，所以看到的比例與前台一致。完全不呼叫任何 API、不改前台。
 * 預覽裡也可以真的點開、輸入問題（用草稿的規則回覆）。
 */
export default function AssistantPreview({
  settings,
  rules,
  device,
  lang,
  onLangChange,
  chatOpen,
  onChatOpenChange,
  forcedState = null,
}: {
  settings: AssistantSettings;
  rules: AssistantRuleData[];
  device: PreviewDevice;
  lang: AssistantLang;
  onLangChange: (l: AssistantLang) => void;
  chatOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
  /** 後台「預覽動作」按鈕：強制顯示某個狀態（null＝依預覽對話實際結果） */
  forcedState?: AvatarState | null;
}) {
  const frame = FRAMES[device];
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [exchange, setExchange] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [outcome, setOutcome] = useState<ReplyOutcome | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarState = forcedState ?? resolveAvatarState({ pending: thinking, outcome });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / frame.w));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame.w]);

  const size = device === "mobile" ? settings.sizeMobile : settings.sizeDesktop;
  const img = resolveAssistantImage(settings);
  // 以圖片比例估算高度（自訂圖片未知比例時以 1:0.72 估算）
  const ratio = img.width && img.height ? img.height / img.width : 0.72;
  const wHeight = size * ratio;
  const left = settings.position.endsWith("right") ? frame.w - size - settings.edgeDistance : settings.edgeDistance;
  const top = settings.position.startsWith("bottom") ? frame.h - wHeight - settings.edgeDistance : settings.edgeDistance;
  const name = lang === "en" ? settings.nameEn : settings.nameZh;

  const greeting: ChatMessage = {
    id: "greeting",
    role: "assistant",
    text: lang === "en" ? settings.welcomeEn : settings.welcomeZh,
  };

  function send(text: string) {
    setExchange((m) => [...m, { id: `u-${Date.now()}`, role: "user", text }]);
    if (holdRef.current) clearTimeout(holdRef.current);
    setOutcome(null);
    setThinking(true);
    window.setTimeout(
      () => {
        // 與前台完全相同的判斷：規則命中 → 回答（生活資訊類另有動作）；沒命中 → 暫時無法解決
        const result = matchMockResult(text, lang, { rules, fallbackZh: settings.fallbackZh, fallbackEn: settings.fallbackEn });
        setExchange((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", text: result.text }]);
        setThinking(false);
        setOutcome(result.kind === "fallback" ? { kind: "unresolved", reason: "no_match" } : { kind: "answered", topic: classifyLifeTopic(text) });
        holdRef.current = setTimeout(() => setOutcome(null), AVATAR_HOLD_MS);
      },
      settings.showTyping ? 700 : 0
    );
  }

  const panel = computePanelStyle(frame.w > 0 ? { w: frame.w, h: frame.h } : { w: 1, h: 1 }, { left, top, width: size, height: wHeight }, settings);

  return (
    <div ref={wrapRef} className="w-full">
      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-ink-100 bg-[linear-gradient(135deg,#f8fafc,#e8f1f6)]"
        style={{ width: frame.w * scale, height: frame.h * scale }}
        data-testid="assistant-preview-frame"
      >
        <div style={{ width: frame.w, height: frame.h, transform: `scale(${scale})`, transformOrigin: "top left" }} className="relative">
          {/* 假的網站內容，讓預覽有「頁面」的感覺 */}
          <div className="absolute inset-x-0 top-0 h-12 bg-white/80 shadow-sm" />
          <div className="absolute left-6 right-6 top-20 space-y-3 opacity-60">
            <div className="h-6 w-1/3 rounded bg-ink-100" />
            <div className="h-3 w-2/3 rounded bg-ink-100" />
            <div className="h-3 w-1/2 rounded bg-ink-100" />
          </div>

          <div
            role="button"
            aria-label="preview-willo"
            onClick={() => onChatOpenChange(!chatOpen)}
            className="absolute cursor-pointer"
            style={{
              left,
              top,
              width: size,
              filter: settings.showShadow ? "drop-shadow(0 6px 10px rgba(0,0,0,0.25))" : undefined,
            }}
          >
            <WilloAvatar settings={settings} state={avatarState} alt={name} />
          </div>

          {chatOpen && (
            <AssistantChatPanel
              settings={settings}
              lang={lang}
              onLangChange={onLangChange}
              messages={[greeting, ...exchange]}
              thinking={thinking}
              onSend={send}
              onClose={() => onChatOpenChange(false)}
              style={panel}
              positioning="absolute"
              autoFocus={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
