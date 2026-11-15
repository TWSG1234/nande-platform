/**
 * 威洛「問題類型與角色狀態」（純函式）。
 *
 * 流程：使用者提問 → 既有搜尋流程（lib/ai/search）找出答案 → 這裡把結果轉成「訊號」→ 依後台設定找出對應類型
 *       → 回答完成後威洛換成該類型的外觀。思考中（thinking）仍由「等待回應」決定，不經過這裡。
 *
 * 訊號（全部來自既有流程，不是另外猜的）：
 *   topic:transport|food|daily|campus|culture  既有主題分類（classifyLifeTopic／資料分類）的結果
 *   source:life|campus|calendar|chinese|knowledge|rule  最相關那筆資料的來源（生活座標、校園座標、行事曆、中文學習、知識庫、常見回覆）
 *   fallback  搜尋流程找不到任何相關資料（原本顯示「暫時無法解決」）
 * 輔助關鍵字只有在流程「已找到答案」時才參與（比對問題＋最相關資料的標題），不會單靠使用者輸入某個字就強制切換。
 */
export const SIGNAL_OPTIONS: { value: string; zh: string; group: "topic" | "source" | "flow" }[] = [
  { value: "topic:transport", zh: "主題：交通", group: "topic" },
  { value: "topic:food", zh: "主題：飲食", group: "topic" },
  { value: "topic:daily", zh: "主題：日常生活／購物", group: "topic" },
  { value: "topic:campus", zh: "主題：校園生活", group: "topic" },
  { value: "topic:culture", zh: "主題：台灣文化／節日", group: "topic" },
  { value: "source:life", zh: "答案來自：生活座標", group: "source" },
  { value: "source:campus", zh: "答案來自：校園座標", group: "source" },
  { value: "source:calendar", zh: "答案來自：台灣行事曆", group: "source" },
  { value: "source:chinese", zh: "答案來自：中文學習", group: "source" },
  { value: "source:knowledge", zh: "答案來自：威洛知識庫", group: "source" },
  { value: "source:rule", zh: "答案來自：威洛常見回覆（問候等）", group: "source" },
  { value: "fallback", zh: "找不到答案", group: "flow" },
];
const SIGNAL_SET = new Set(SIGNAL_OPTIONS.map((s) => s.value));

/** 系統必要狀態（不可刪除；找不到對應類型時的安全回退）。圖片在「動作圖片」區設定。 */
export const SYSTEM_STATES = [
  { key: "idle", zh: "待機（預設）", note: "沒有任何類型符合、或沒有在回答時使用。圖片＝威洛原圖。" },
  { key: "thinking", zh: "思考中", note: "送出問題到收到回答之間，一律優先使用。" },
  { key: "life_info", zh: "生活資訊回答", note: "沒有自訂類型符合、但屬於生活資訊主題時使用。" },
  { key: "unresolved", zh: "暫時無法解決", note: "找不到答案、錯誤或逾時時使用。" },
] as const;

export interface QuestionTypeData {
  id: string;
  key: string;
  nameZh: string;
  nameEn: string;
  labelZh: string;
  labelEn: string;
  signals: string[];
  keywords: string[];
  imageUrl: string;
  enabled: boolean;
  priority: number;
}
export interface PublicQuestionType {
  id: string;
  key: string;
  labelZh: string;
  labelEn: string;
  imageUrl: string;
}

const clampStr = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const safeImageUrl = (v: unknown) => {
  const s = clampStr(v, 500);
  return s && ((s.startsWith("/") && !s.startsWith("//") && !s.includes("..")) || /^https:\/\//.test(s)) ? s : "";
};
export function splitList(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\n,，、;；]/) : [];
  return arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 50);
}
export const joinSignals = (a: string[]) => a.filter((x) => SIGNAL_SET.has(x)).join(",");

/** 資料庫列 → 乾淨資料。 */
export function fromRow(r: Record<string, any>): QuestionTypeData {
  return {
    id: String(r.id),
    key: String(r.key ?? r.id),
    nameZh: String(r.nameZh ?? ""),
    nameEn: String(r.nameEn ?? ""),
    labelZh: String(r.labelZh ?? ""),
    labelEn: String(r.labelEn ?? ""),
    signals: splitList(r.signals).filter((x) => SIGNAL_SET.has(x)),
    keywords: splitList(r.keywords),
    imageUrl: safeImageUrl(r.imageUrl),
    enabled: r.enabled !== false,
    priority: Number.isFinite(Number(r.priority)) ? Math.round(Number(r.priority)) : 100,
  };
}

/** request body → 可寫入的欄位（驗證過）。 */
export function sanitizeTypeInput(b: any): { ok: true; data: Omit<QuestionTypeData, "id" | "key"> } | { ok: false; error: string } {
  const nameZh = clampStr(b?.nameZh, 40);
  if (!nameZh) return { ok: false, error: "請填寫問題類型名稱。" };
  const signals = splitList(b?.signals).filter((x) => SIGNAL_SET.has(x));
  const keywords = splitList(b?.keywords).map((k) => k.slice(0, 40));
  return {
    ok: true,
    data: {
      nameZh,
      nameEn: clampStr(b?.nameEn, 60),
      labelZh: clampStr(b?.labelZh, 20),
      labelEn: clampStr(b?.labelEn, 30),
      signals,
      keywords,
      imageUrl: safeImageUrl(b?.imageUrl),
      enabled: b?.enabled !== false,
      priority: Math.min(9999, Math.max(0, Math.round(Number(b?.priority)) || 100)),
    },
  };
}

/** 既有流程的結果 → 訊號。 */
export function computeSignals(input: { fallback: boolean; topic?: string | null; sourceKind?: string | null }): string[] {
  if (input.fallback) return ["fallback"];
  const out: string[] = [];
  if (input.topic) out.push(`topic:${input.topic}`);
  if (input.sourceKind) out.push(`source:${input.sourceKind}`);
  return out.filter((x) => SIGNAL_SET.has(x));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * 找出對應的類型：只看「啟用」的類型，依優先順序（數字小的優先，相同則先建立的先）。
 * 符合條件＝訊號有交集，或（流程有找到答案時）輔助關鍵字出現在 問題＋最相關資料標題 中。找不到回傳 null（呼叫端回退到內建狀態）。
 */
export function matchQuestionType(types: QuestionTypeData[], ctx: { signals: string[]; text: string; fallback: boolean }): QuestionTypeData | null {
  const sig = new Set(ctx.signals);
  const text = norm(ctx.text);
  const sorted = types.map((t, i) => ({ t, i })).filter(({ t }) => t.enabled).sort((a, b) => a.t.priority - b.t.priority || a.i - b.i);
  for (const { t } of sorted) {
    if (t.signals.some((s) => sig.has(s))) return t;
    if (!ctx.fallback && t.keywords.some((k) => norm(k) && text.includes(norm(k)))) return t;
  }
  return null;
}

export const toPublic = (t: QuestionTypeData): PublicQuestionType => ({ id: t.id, key: t.key, labelZh: t.labelZh, labelEn: t.labelEn, imageUrl: t.imageUrl });

/** 由名稱產生穩定代碼（英數；中文名稱用時間戳）。 */
export function makeKey(nameEn: string, existing: Set<string>): string {
  const base = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "type";
  let k = base,
    n = 2;
  while (existing.has(k) || ["idle", "thinking", "life_info", "unresolved"].includes(k)) k = `${base}-${n++}`;
  return k;
}
