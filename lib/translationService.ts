/**
 * 雙語欄位（中文／English）的共用邏輯。
 *
 * 重要：目前網站**完全沒有自動翻譯功能**。之前試過接 LibreTranslate，已經
 * 整個移除了——不呼叫任何外部翻譯服務，不需要 Docker、WSL、LibreTranslate
 * 或任何 API Key。
 *
 * 這個檔案唯一做的事，是「管理員自己填的英文，永遠不會被覆蓋」這個規則：
 *
 * - 管理員在英文欄位打字、標記成 MANUAL → 存他填的內容，之後修改中文也
 *   不會動到這個英文欄位。
 * - 英文欄位是空的、或還沒被標記成 MANUAL（AUTO）→ 直接把中文複製一份
 *   存進英文欄位（不是翻譯，只是避免英文欄位整個空白），管理員隨時可以
 *   自己把它改成真正的英文。
 *
 * 全站十幾個後台 API（公告、校園座標、生活座標、行事曆、IP角色、關於我們、
 * 照片投稿…）都呼叫這裡的 resolveBilingualField(s)，介面沒有改變，所以這次
 * 移除 LibreTranslate 不需要動到任何一個呼叫端。
 *
 * 如果之後要重新加自動翻譯，只需要在這個檔案裡實作真正的翻譯呼叫，把
 * resolveBilingualField 裡「直接複製中文」的那一行換成呼叫翻譯服務即可，
 * 其他檔案完全不用動。目前這一輪明確不要加任何翻譯服務。
 */

export type EnglishSource = "AUTO" | "MANUAL";

/**
 * 決定一個雙語欄位最後要存的英文內容與來源標記。
 * - source 是 "MANUAL" 而且有填英文 → 用管理員填的內容，不動。
 * - 其他情況 → 英文直接等於中文（沒有任何翻譯發生），標記 "AUTO"。
 * - 中文是空字串的欄位（選填欄位沒填）不需要處理，直接回傳空值。
 */
export function resolveBilingualField(params: {
  zh: string | null | undefined;
  submittedEn: string | null | undefined;
  submittedSource: EnglishSource | null | undefined; // 表單送出的來源標記（見 BilingualField 元件）
}): { value: string; source: EnglishSource } {
  const zh = (params.zh || "").trim();
  if (!zh) return { value: "", source: "AUTO" }; // 選填欄位沒填中文，英文也不用處理

  const en = (params.submittedEn || "").trim();
  if (en && (params.submittedSource === "MANUAL" || looksLikeRealEnglish(en, zh))) {
    return { value: en, source: "MANUAL" };
  }

  return { value: zh, source: "AUTO" }; // 沒有翻譯服務，英文暫時等於中文，管理員可自行修改
}

/**
 * 「已經是真正英文」的判斷（不依賴表單有沒有帶 MANUAL 標記）。
 *
 * 為什麼需要：過去只認 MANUAL 標記，但很多情況表單不會帶標記——資料是匯入或先前版本留下的
 * （enSource 欄位是空的）、後台某些表單用一般輸入框（沒有 MANUAL 機制）、列表頁的「顯示／隱藏」
 * 切換會把整筆資料送回來——這些都會被當成 AUTO，英文就被中文整個覆蓋掉，前台英文模式因此看到中文。
 * 規則：英文欄不是空的、不等於中文、而且主要由拉丁字母組成（不是中文複製品）→ 一律保留，不覆蓋。
 */
export function looksLikeRealEnglish(en: string, zh: string): boolean {
  const t = en.trim();
  if (!t || t === zh.trim()) return false;
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const cjk = (t.match(/[\u3400-\u9fff]/g) || []).length;
  return latin >= 2 && latin >= cjk;
}

/**
 * 一次處理一個 model 裡「所有」雙語欄位，回傳可以直接展開進 Prisma
 * `data: {...}` 的物件，以及要存進 enSource 欄位的 JSON 字串。
 *
 * 例：
 *   const { values, enSourceJson } = resolveBilingualFields({
 *     title: { zh: body.titleZh, en: body.titleEn, source: body.titleEnSource },
 *     content: { zh: body.contentZh, en: body.contentEn, source: body.contentEnSource },
 *   });
 *   // values = { titleEn: "...", contentEn: "..." }
 *   // enSourceJson = '{"titleEn":"AUTO","contentEn":"MANUAL"}'
 */
export type BilingualInput = { zh: string | null | undefined; en: string | null | undefined; source: EnglishSource | null | undefined };

export function resolveBilingualFields<F extends Record<string, BilingualInput | undefined>>(
  fields: F
): {
  // 回傳型別依傳入的欄位名稱決定：傳 title／content → values.titleEn、values.contentEn 都是 string；
  // 如果某個欄位在型別上是選填（例如 details?），對應的英文值就是 string | undefined，使用前要先判斷。
  values: { [P in keyof F & string as `${P}En`]: undefined extends F[P] ? string | undefined : string };
  enSourceJson: string;
} {
  // 執行時，每個「有傳入」的欄位一定會得到字串：沒填中文是 ""、管理員手動填的英文照用、其他情況暫時等於中文。
  const values: Record<string, string> = {};
  const sourceMap: Record<string, EnglishSource> = {};

  for (const [key, f] of Object.entries(fields)) {
    if (!f) continue;
    const resolved = resolveBilingualField({ zh: f.zh, submittedEn: f.en, submittedSource: f.source });
    const enKey = `${key}En`;
    values[enKey] = resolved.value;
    sourceMap[enKey] = resolved.source;
  }

  return { values: values as never, enSourceJson: JSON.stringify(sourceMap) };
}
