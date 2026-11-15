/**
 * 首頁 IP 角色版面（純函式，伺服器／瀏覽器都能用，可獨立測試）。
 *
 * 定位方式（為什麼不會再「平板跑掉」）
 * - 三種裝置各有自己一組設定：手機（< 640px）、平板（640–1023px）、桌機（≥ 1024px）。
 *   斷點與首頁 Hero 的 sm／lg 一致；切換裝置只會換成另一組已儲存的設定，不會拿桌機座標硬套在平板上。
 * - 座標以「首頁主視覺區（<section data-home-hero>）」為唯一基準，全部是百分比：
 *     left = x%、top = y%，再用 translate(-x%, -y%) 把角色「自己的 x%／y%」對齊過去（錨點式）。
 *     所以 x=0 一定貼齊左緣、x=100 一定貼齊右緣、y 同理——不管角色多大、畫面多寬，角色永遠完整留在主視覺區內，
 *     視窗只差幾 px 也不會突然大幅位移（位置是比例，不是固定 px）。
 * - 大小是「主視覺區寬度的百分比」並限制最小／最大 px；高度由圖片原始比例自動決定（height:auto），圖片不會變形。
 * - 旋轉、左右翻轉用 transform；浮動／點擊彈跳動畫在內層，不會和定位互相干擾。
 * 所有會進到 CSS 的值都是這裡驗證過的數字或固定選項，不接受自由文字，不可能注入 CSS。
 */
export type IpCharId = "characterA" | "characterB" | "characterC";
export const IP_CHAR_IDS: IpCharId[] = ["characterA", "characterB", "characterC"];
export type IpDevice = "desktop" | "tablet" | "mobile";
export const IP_DEVICES: IpDevice[] = ["desktop", "tablet", "mobile"];

/** 管理員看得懂的名稱（首頁位置 A／B／C 固定對應的角色） */
export const IP_CHAR_NAMES: Record<IpCharId, { zh: string; en: string }> = {
  characterA: { zh: "布迪", en: "Budi" },
  characterB: { zh: "威洛", en: "Willow" },
  characterC: { zh: "帕菲", en: "Puffy" },
};

export const TABLET_MIN_WIDTH = 640; // 與 Tailwind sm 一致
export const DESKTOP_MIN_WIDTH = 1024; // 與 Tailwind lg 一致
export const MIN_PX = 36; // 角色最小寬度（px）
export const MAX_PX = 420; // 角色最大寬度（px）

export type IpDeviceSettings = {
  visible: boolean;
  /** 水平位置 0–100（%）：0＝貼齊主視覺區左緣、100＝貼齊右緣 */
  x: number;
  /** 垂直位置 0–100（%）：0＝貼齊上緣、100＝貼齊下緣 */
  y: number;
  /** 寬度，佔主視覺區寬度的百分比（3–60）；高度依原圖比例自動決定 */
  size: number;
  /** 旋轉角度 -180–180 */
  rotate: number;
  /** 左右翻轉 */
  flip: boolean;
};

export type IpCharLayout = Record<IpDevice, IpDeviceSettings>;
export type IpLayouts = Record<IpCharId, IpCharLayout>;
/** 哪些裝置的設定是管理員真正儲存過的（false＝目前使用預設值） */
export type IpSavedFlags = Record<IpCharId, Record<IpDevice, boolean>>;

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" ? n : typeof n === "string" && n.trim() !== "" ? Number(n) : NaN;
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export function sanitizeIpDevice(input: unknown, base: IpDeviceSettings): IpDeviceSettings {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    visible: typeof o.visible === "boolean" ? o.visible : base.visible,
    x: round1(clamp(o.x, 0, 100, base.x)),
    y: round1(clamp(o.y, 0, 100, base.y)),
    size: round1(clamp(o.size, 3, 60, base.size)),
    rotate: Math.round(clamp(o.rotate, -180, 180, base.rotate)),
    flip: typeof o.flip === "boolean" ? o.flip : base.flip,
  };
}

/** 資料庫存的是 JSON 字串；壞掉或不存在回傳 null（呼叫端改用預設值，不會丟錯）。 */
export function parseIpDeviceJson(json: unknown, base: IpDeviceSettings): IpDeviceSettings | null {
  if (json === null || json === undefined || json === "") return null;
  if (typeof json !== "string") return typeof json === "object" ? sanitizeIpDevice(json, base) : null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? sanitizeIpDevice(v, base) : null;
  } catch {
    return null;
  }
}

/**
 * 預設值（只在管理員「尚未儲存」該裝置時使用）。
 * 桌機／平板各自設計，不是同一組座標；手機預設沿用既有「手機版管理」的順序、顯示與大小倍率。
 * 這些數字由真實首頁版面量測後決定（見 tests/bundle/run_ip.py 的版面檢查）。
 */
const DEFAULT_DESKTOP: Record<IpCharId, IpDeviceSettings> = {
  characterC: { visible: true, x: 98, y: 4, size: 13, rotate: 0, flip: false },
  characterA: { visible: true, x: 76, y: 20, size: 13, rotate: 0, flip: false },
  characterB: { visible: true, x: 98, y: 56, size: 14, rotate: 0, flip: false },
};
const DEFAULT_TABLET: Record<IpCharId, IpDeviceSettings> = {
  characterC: { visible: true, x: 97, y: 3, size: 10, rotate: 0, flip: false },
  characterA: { visible: true, x: 70, y: 96, size: 12, rotate: 0, flip: false },
  characterB: { visible: true, x: 97, y: 96, size: 14, rotate: 0, flip: false },
};

export type MobileIpPrefs = { id: IpCharId; isVisible: boolean; order: number; sizeScale: number };

/** 手機預設：三隻角色排成一排放在主視覺區底部（和舊版手機 IP 列相同的樣子），順序／顯示／大小倍率沿用「手機版管理」。 */
export function defaultMobile(prefs?: MobileIpPrefs[]): Record<IpCharId, IpDeviceSettings> {
  const list = (prefs && prefs.length ? prefs : IP_CHAR_IDS.map((id, i) => ({ id, isVisible: true, order: i, sizeScale: 1 }))).slice();
  const sorted = [...list].sort((a, b) => a.order - b.order);
  const slotX = [10, 50, 90];
  const out = {} as Record<IpCharId, IpDeviceSettings>;
  sorted.forEach((p, i) => {
    out[p.id] = { visible: p.isVisible, x: slotX[i] ?? 50, y: 96, size: round1(Math.min(60, Math.max(3, 22 * (p.sizeScale || 1)))), rotate: 0, flip: false };
  });
  for (const id of IP_CHAR_IDS) if (!out[id]) out[id] = { visible: true, x: 50, y: 96, size: 22, rotate: 0, flip: false };
  return out;
}

export function defaultSettings(device: IpDevice, id: IpCharId, mobilePrefs?: MobileIpPrefs[]): IpDeviceSettings {
  if (device === "mobile") return defaultMobile(mobilePrefs)[id];
  if (device === "tablet") return { ...DEFAULT_TABLET[id] };
  return { ...DEFAULT_DESKTOP[id] };
}

export function defaultLayouts(mobilePrefs?: MobileIpPrefs[]): IpLayouts {
  const out = {} as IpLayouts;
  for (const id of IP_CHAR_IDS) out[id] = { desktop: defaultSettings("desktop", id), tablet: defaultSettings("tablet", id), mobile: defaultSettings("mobile", id, mobilePrefs) };
  return out;
}

/** 把「資料庫列」合併成完整三裝置設定：有儲存的用儲存的，沒有的才用該裝置自己的預設值。 */
export function resolveLayouts(
  rows: { id: string; desktopJson?: unknown; tabletJson?: unknown; mobileJson?: unknown }[],
  mobilePrefs?: MobileIpPrefs[]
): { layouts: IpLayouts; saved: IpSavedFlags } {
  const layouts = defaultLayouts(mobilePrefs);
  const saved = {} as IpSavedFlags;
  for (const id of IP_CHAR_IDS) {
    saved[id] = { desktop: false, tablet: false, mobile: false };
    const row = rows.find((r) => r.id === id);
    if (!row) continue;
    for (const dev of IP_DEVICES) {
      const parsed = parseIpDeviceJson(row[`${dev}Json` as "desktopJson"], layouts[id][dev]);
      if (parsed) {
        layouts[id][dev] = parsed;
        saved[id][dev] = true;
      }
    }
  }
  return { layouts, saved };
}

/** 後台預覽／API 傳來的整包設定：每個欄位都重新驗證。 */
export function sanitizeLayouts(input: unknown, base: IpLayouts): IpLayouts {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, any>;
  const out = {} as IpLayouts;
  for (const id of IP_CHAR_IDS) {
    out[id] = {
      desktop: sanitizeIpDevice(o[id]?.desktop, base[id].desktop),
      tablet: sanitizeIpDevice(o[id]?.tablet, base[id].tablet),
      mobile: sanitizeIpDevice(o[id]?.mobile, base[id].mobile),
    };
  }
  return out;
}

export const ipClass = (id: IpCharId) => `ipl-${id.slice(-1)}`; // ipl-A / ipl-B / ipl-C

function rule(s: IpDeviceSettings, hide: boolean): string {
  if (!s.visible || hide) return "display:none;";
  // 錨點式定位：left/top 用百分比，translate 用「自己的」同一個百分比；寬度 = 主視覺區寬度的 size%，並限制最小／最大 px。
  return `display:block;left:${s.x}%;top:${s.y}%;width:clamp(${MIN_PX}px,${s.size}%,${MAX_PX}px);transform:translate(-${s.x}%,-${s.y}%);`;
}
/** 旋轉／翻轉套在內層（.ipr），外層只負責定位——對話框放在外層，不會跟著旋轉或被鏡像。 */
function innerRule(s: IpDeviceSettings): string {
  return `transform:rotate(${s.rotate}deg) scaleX(${s.flip ? -1 : 1});`;
}

/**
 * 產生這三隻角色的 CSS。手機規則是預設，平板、桌機放在 min-width 媒體查詢裡。
 * hideMobile：「手機版管理」裡關閉「IP 角色列」時，手機一律不顯示（沿用既有開關）。
 */
export function buildIpLayoutCss(layouts: IpLayouts, opts: { hideMobile?: boolean } = {}): string {
  const out: string[] = [];
  const both = (c: string, s: IpDeviceSettings, hide: boolean) => `${c}{${rule(s, hide)}}${c} .ipr{${innerRule(s)}}`;
  for (const id of IP_CHAR_IDS) {
    const c = `.${ipClass(id)}`;
    out.push(both(c, layouts[id].mobile, !!opts.hideMobile));
    out.push(`@media (min-width:${TABLET_MIN_WIDTH}px){${both(c, layouts[id].tablet, false)}}`);
    out.push(`@media (min-width:${DESKTOP_MIN_WIDTH}px){${both(c, layouts[id].desktop, false)}}`);
  }
  return out.join("\n");
}

export function deviceForWidth(w: number): IpDevice {
  return w >= DESKTOP_MIN_WIDTH ? "desktop" : w >= TABLET_MIN_WIDTH ? "tablet" : "mobile";
}

/** 手機版是否有任何角色會顯示（決定要不要在 Hero 底部預留一排角色的位置）。 */
export function mobileHasVisible(layouts: IpLayouts, hideMobile?: boolean): boolean {
  return !hideMobile && IP_CHAR_IDS.some((id) => layouts[id].mobile.visible);
}
