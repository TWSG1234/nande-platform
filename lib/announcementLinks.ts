/**
 * 重要公告的文字連結（純函式，伺服器／瀏覽器共用，可獨立測試）。
 *
 * 跳轉目標三種：
 *  - page     站內固定頁面（用穩定的路徑，只能是下面清單裡的）
 *  - item     站內指定內容（用資料 ID：生活座標項目、校園座標項目、中文學習關卡），網址由程式組出，不依賴顯示名稱
 *  - external 管理員設定的外部網址：只允許 https，且不可含帳號密碼
 * 顏色只允許 #RRGGBB。所有輸入都重新驗證，不合法的連結直接丟掉（不會進到前台）。
 */
export type Localized = { "zh-TW": string; en: string };

export const PAGE_TARGETS: { path: string; zh: string }[] = [
  { path: "/", zh: "首頁" },
  { path: "/life", zh: "生活座標" },
  { path: "/campus", zh: "校園座標" },
  { path: "/chinese", zh: "中文學習" },
  { path: "/chinese/life", zh: "中文學習：生活篇" },
  { path: "/chinese/campus", zh: "中文學習：校園篇" },
  { path: "/calendar", zh: "台灣行事曆" },
  { path: "/ip-characters", zh: "IP 角色" },
  { path: "/about", zh: "關於我們" },
  { path: "/photo-submit", zh: "照片投稿" },
];
export const ITEM_KINDS: { kind: ItemKind; zh: string; base: string }[] = [
  { kind: "life", zh: "生活座標項目", base: "/life/" },
  { kind: "campus", zh: "校園座標項目", base: "/campus/" },
  { kind: "chinese-life", zh: "中文學習（生活篇）關卡", base: "/chinese/life/" },
  { kind: "chinese-campus", zh: "中文學習（校園篇）關卡", base: "/chinese/campus/" },
];
export type ItemKind = "life" | "campus" | "chinese-life" | "chinese-campus";

/** 預設顏色（對淺色／深色卡片都有足夠對比）。管理員也可輸入其他 #RRGGBB。 */
export const LINK_COLORS: { value: string; zh: string }[] = [
  { value: "#2a6ea2", zh: "海藍" },
  { value: "#c2410c", zh: "橘紅" },
  { value: "#15803d", zh: "草綠" },
  { value: "#7e22ce", zh: "紫" },
  { value: "#be185d", zh: "莓紅" },
  { value: "#0e7490", zh: "青" },
];

export type LinkTarget =
  | { type: "page"; path: string }
  | { type: "item"; kind: ItemKind; id: string }
  | { type: "external"; url: string };

export interface AnnouncementLink {
  id: string;
  labelZh: string;
  labelEn: string;
  color: string;
  target: LinkTarget;
}
export interface AnnouncementLinkSetData {
  show: boolean;
  links: AnnouncementLink[];
}
/** 前台用：已解析好網址的連結。 */
export interface LinkView {
  id: string;
  label: Localized;
  href: string;
  external: boolean;
  color: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
export const MAX_LINKS = 8;

/** 外部網址：只接受 https、不含帳號密碼；回傳正規化後的網址，不合法回傳 null。 */
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 500 || /[\s\u0000-\u001f]/.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function sanitizeTarget(t: any): LinkTarget | null {
  if (!t || typeof t !== "object") return null;
  if (t.type === "page") return PAGE_TARGETS.some((p) => p.path === t.path) ? { type: "page", path: t.path } : null;
  if (t.type === "item") return ITEM_KINDS.some((k) => k.kind === t.kind) && typeof t.id === "string" && ID_RE.test(t.id) ? { type: "item", kind: t.kind, id: t.id } : null;
  if (t.type === "external") {
    const url = safeExternalUrl(t.url);
    return url ? { type: "external", url } : null;
  }
  return null;
}

export function hrefFor(t: LinkTarget): string {
  if (t.type === "page") return t.path;
  if (t.type === "external") return t.url;
  return ITEM_KINDS.find((k) => k.kind === t.kind)!.base + encodeURIComponent(t.id);
}

/** request body／資料庫 JSON → 乾淨資料。回傳 errors＝被丟掉的連結說明（給後台顯示）。 */
export function sanitizeLinkSet(input: any): { data: AnnouncementLinkSetData; errors: string[] } {
  const errors: string[] = [];
  const arr = Array.isArray(input?.links) ? input.links : [];
  const links: AnnouncementLink[] = [];
  arr.slice(0, MAX_LINKS).forEach((l: any, i: number) => {
    const labelZh = typeof l?.labelZh === "string" ? l.labelZh.trim().slice(0, 20) : "";
    if (!labelZh) return void errors.push(`第 ${i + 1} 個連結沒有顯示文字，已略過。`);
    const target = sanitizeTarget(l?.target);
    if (!target) return void errors.push(`「${labelZh}」的跳轉目標不合法（外部網址只允許 https），已略過。`);
    links.push({
      id: typeof l?.id === "string" && ID_RE.test(l.id) ? l.id : `l${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
      labelZh,
      labelEn: typeof l?.labelEn === "string" ? l.labelEn.trim().slice(0, 40) : "",
      color: typeof l?.color === "string" && HEX.test(l.color) ? l.color.toLowerCase() : LINK_COLORS[0]!.value,
      target,
    });
  });
  if (arr.length > MAX_LINKS) errors.push(`最多 ${MAX_LINKS} 個連結，多的已略過。`);
  return { data: { show: input?.show !== false, links }, errors };
}

export function parseLinkSetRow(row: { show?: unknown; linksJson?: unknown } | null | undefined): AnnouncementLinkSetData {
  if (!row) return { show: true, links: [] };
  let links: unknown = [];
  try {
    links = JSON.parse(String(row.linksJson ?? "[]"));
  } catch {
    links = [];
  }
  return sanitizeLinkSet({ show: row.show !== false, links }).data;
}

/** 前台：只回傳要顯示的連結（show=false 或沒有連結 → 空陣列）。 */
export function toLinkViews(set: AnnouncementLinkSetData | null | undefined): LinkView[] {
  if (!set || !set.show) return [];
  return set.links.map((l) => ({
    id: l.id,
    label: { "zh-TW": l.labelZh, en: l.labelEn || l.labelZh },
    href: hrefFor(l.target),
    external: l.target.type === "external",
    color: l.color,
  }));
}
