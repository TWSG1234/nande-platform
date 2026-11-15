import { DEFAULT_ASSISTANT_SETTINGS } from "./defaults";
import type { AssistantRuleData, AssistantSettings } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;
const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
const BUTTONS = ["round", "square", "pill"] as const;
const LANGS = ["zh-TW", "en"] as const;

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};
const str = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v : fallback);
/** 只接受本站上傳路徑（/uploads/…、/images/…）或 https 圖片網址，擋掉 javascript: 之類。 */
const imageUrl = (v: unknown) => {
  if (typeof v !== "string") return "";
  const s = v.trim().slice(0, 500);
  if (!s) return "";
  return s.startsWith("/") && !s.startsWith("//") ? s : /^https:\/\//.test(s) ? s : "";
};

/** 伺服器端：把 request body 轉成乾淨、合法範圍內的設定（任何欄位壞掉就用預設值）。 */
export function sanitizeSettings(input: unknown): AssistantSettings {
  const d = DEFAULT_ASSISTANT_SETTINGS;
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    enabled: bool(b.enabled, d.enabled),
    nameZh: str(b.nameZh, 30, d.nameZh).trim() || d.nameZh,
    nameEn: str(b.nameEn, 30, d.nameEn).trim() || d.nameEn,
    welcomeZh: str(b.welcomeZh, 500, d.welcomeZh),
    welcomeEn: str(b.welcomeEn, 500, d.welcomeEn),
    fallbackZh: str(b.fallbackZh, 500, d.fallbackZh),
    fallbackEn: str(b.fallbackEn, 500, d.fallbackEn),
    defaultLang: pick(b.defaultLang, LANGS, d.defaultLang),
    allowLangSwitch: bool(b.allowLangSwitch, d.allowLangSwitch),
    showName: bool(b.showName, d.showName),
    showTyping: bool(b.showTyping, d.showTyping),
    keepHistory: bool(b.keepHistory, d.keepHistory),

    imageUrl: imageUrl(b.imageUrl),
    thinkingImageUrl: imageUrl(b.thinkingImageUrl),
    unresolvedImageUrl: imageUrl(b.unresolvedImageUrl),
    lifeInfoImageUrl: imageUrl(b.lifeInfoImageUrl),
    sizeDesktop: num(b.sizeDesktop, 60, 300, d.sizeDesktop),
    sizeMobile: num(b.sizeMobile, 48, 200, d.sizeMobile),
    position: pick(b.position, CORNERS, d.position),
    edgeDistance: num(b.edgeDistance, 0, 200, d.edgeDistance),
    panelWidth: num(b.panelWidth, 260, 560, d.panelWidth),
    panelHeight: num(b.panelHeight, 300, 800, d.panelHeight),
    panelRadius: num(b.panelRadius, 0, 40, d.panelRadius),
    primaryColor: color(b.primaryColor, d.primaryColor),
    secondaryColor: color(b.secondaryColor, d.secondaryColor),
    bgColor: color(b.bgColor, d.bgColor),
    textColor: color(b.textColor, d.textColor),
    buttonStyle: pick(b.buttonStyle, BUTTONS, d.buttonStyle),
    showShadow: bool(b.showShadow, d.showShadow),
    allowDrag: bool(b.allowDrag, d.allowDrag),
    showLangButton: bool(b.showLangButton, d.showLangButton),
  };
}

export const MAX_RULES = 100;

/** 規則清單：最多 MAX_RULES 筆，沒有關鍵字的規則會被丟掉；順序即為優先順序。 */
export function sanitizeRules(input: unknown): Omit<AssistantRuleData, "id">[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_RULES)
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
    .map((r) => ({
      keywords: str(r.keywords, 500, "").trim(),
      replyZh: str(r.replyZh, 1000, ""),
      replyEn: str(r.replyEn, 1000, ""),
      enabled: bool(r.enabled, true),
    }))
    .filter((r) => r.keywords.length > 0)
    .map((r, i) => ({ ...r, priority: (i + 1) * 10 }));
}
