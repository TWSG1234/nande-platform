/**
 * 首頁裝飾圖樣：型別、設定驗證、CSS 產生（純函式，伺服器／瀏覽器都能用，可獨立測試）。
 * 所有會進到 CSS 的值都是這裡驗證過的「數字」或「固定選項」，不接受任何自由文字，所以不可能注入 CSS。
 */
/** hero＝首頁最上方的藍色橫幅區；body＝橫幅下方（直接放在「首頁底色」上）。 */
export type Area = "hero" | "body";
export const AREAS: Area[] = ["hero", "body"];

export type DeviceSettings = {
  visible: boolean;
  /** 圖片「中心點」的水平位置，佔主視覺區域寬度的百分比。0＝左邊緣、100＝右邊緣；可超出（-50 ~ 150）讓圖片延伸到邊緣外被裁切。 */
  x: number;
  /** 圖片中心點的垂直位置，佔主視覺區域高度的百分比（-50 ~ 150）。 */
  y: number;
  /** 圖片寬度，佔主視覺區域寬度的百分比，1 ~ 150 */
  size: number;
  /** 旋轉角度，-180 ~ 180 */
  rotate: number;
  /** 不透明度百分比，5 ~ 100 */
  opacity: number;
};

export type Decoration = {
  id: string;
  name: string;
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  isVisible: boolean;
  area: Area;
  sortOrder: number;
  desktop: DeviceSettings;
  mobile: DeviceSettings;
};

export const DEFAULT_DESKTOP: DeviceSettings = { visible: true, x: 80, y: 25, size: 14, rotate: 0, opacity: 100 };
export const DEFAULT_MOBILE: DeviceSettings = { visible: true, x: 80, y: 12, size: 28, rotate: 0, opacity: 100 };

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" ? n : typeof n === "string" && n.trim() !== "" ? Number(n) : NaN;
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

/** 舊版（錨點式）設定轉成「中心點百分比」：只在讀到舊資料時用一次，之後儲存就是新格式。 */
function legacyCenter(o: Record<string, unknown>, base: DeviceSettings): Partial<DeviceSettings> {
  const a = o.anchor;
  if (typeof a !== "string" || "cx" in o) return {};
  const size = clamp(o.size, 1, 150, base.size);
  const x = clamp(o.x, -50, 100, 2);
  const y = clamp(o.y, -50, 100, 2);
  const half = size / 2;
  switch (a) {
    case "top-left": return { x: x + half, y: y + half };
    case "top-right": return { x: 100 - x - half, y: y + half };
    case "bottom-left": return { x: x + half, y: 100 - y - half };
    case "bottom-right": return { x: 100 - x - half, y: 100 - y - half };
    case "center": return { x: 50 + x, y: 50 + y };
  }
  return {};
}

export function sanitizeDevice(input: unknown, base: DeviceSettings): DeviceSettings {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const legacy = legacyCenter(o, base);
  const src = { ...o, ...legacy } as Record<string, unknown>;
  return {
    visible: typeof src.visible === "boolean" ? src.visible : base.visible,
    x: Math.round(clamp(src.x, -50, 150, base.x) * 10) / 10,
    y: Math.round(clamp(src.y, -50, 150, base.y) * 10) / 10,
    size: Math.round(clamp(src.size, 1, 150, base.size) * 10) / 10,
    rotate: Math.round(clamp(src.rotate, -180, 180, base.rotate)),
    opacity: Math.round(clamp(src.opacity, 5, 100, base.opacity)),
  };
}

export function parseDevice(json: unknown, base: DeviceSettings): DeviceSettings {
  if (typeof json !== "string") return sanitizeDevice(json, base);
  try {
    return sanitizeDevice(JSON.parse(json), base);
  } catch {
    return base;
  }
}

export function cleanName(v: unknown): string {
  return String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40);
}

/** 只留下安全的 CSS class 後綴（資料庫的 id 是 cuid，但不信任它）。 */
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || "x";

function deviceRule(d: DeviceSettings, naturalWidth: number): string {
  void naturalWidth; // 不再用原圖寬度當上限：管理員要放多大就多大（太大會變糊是圖片本身解析度的限制）
  const cap = `${d.size}%`;
  // 以圖片中心點定位；超出容器的部分由圖層容器 overflow:hidden 裁切（不會產生橫向捲軸）
  return `display:block;width:${cap};left:${d.x}%;top:${d.y}%;right:auto;bottom:auto;transform:translate(-50%,-50%) rotate(${d.rotate}deg);opacity:${d.opacity / 100};`;
}

export const DESKTOP_MIN_WIDTH = 640; // 與首頁 Hero 的 sm 斷點一致：≥640px 用桌面版設定，其餘用手機版設定

/**
 * 產生這一批裝飾的 CSS。force="desktop"/"mobile" 用在後台預覽（不依賴視窗寬度）。
 * 每張圖：手機版規則為預設、桌面版放在 min-width 媒體查詢裡；不顯示的裝置用 display:none。
 */
export function buildDecorationCss(list: Decoration[], force?: "desktop" | "mobile"): string {
  const out: string[] = [];
  // 預覽時桌面／手機兩個框同時存在，用 data-decor-scope 區分，避免相同 class 的規則互相覆蓋
  const scope = force ? `[data-decor-scope="${force}"] ` : "";
  for (const d of list) {
    const c = `${scope}.hd-${safeId(d.id)}`;
    const rule = (s: DeviceSettings) => (s.visible ? deviceRule(s, d.naturalWidth) : "display:none;");
    if (force === "desktop") out.push(`${c}{${rule(d.desktop)}}`);
    else if (force === "mobile") out.push(`${c}{${rule(d.mobile)}}`);
    else out.push(`${c}{${rule(d.mobile)}}@media (min-width:${DESKTOP_MIN_WIDTH}px){${c}{${rule(d.desktop)}}}`);
  }
  return out.join("\n");
}

export const classFor = (id: string) => `hd-${safeId(id)}`;

/** 前台實際要顯示的：總開關開啟，且該區域符合。 */
export function visibleIn(list: Decoration[], area: Area): Decoration[] {
  return list.filter((d) => d.isVisible && d.area === area && !!d.imageUrl).sort((a, b) => a.sortOrder - b.sortOrder);
}
