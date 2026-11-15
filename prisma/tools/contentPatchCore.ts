/**
 * 內容小修補（有範圍、可重複執行、不覆蓋後台已改的內容、不重複新增）。
 * 目前只有一項：生活第 1 關「英文版漫畫」換成新圖 life-1-en-v2.png。
 *
 * 規則：
 * - 只有當資料庫裡的英文漫畫「還是舊的內建圖 life-1-en.png」（代表你沒有在後台換過）才會改成新圖。
 * - 已經是新圖 → 不動；是空的 → 補上新圖；是別的圖（你在後台換過）→ 不動，只回報。
 * - 新圖用「新檔名」存進固定資料夾 uploads；舊檔 life-1-en.png 完全不動、不刪除、不覆蓋。
 */
export const LIFE1_STAGE_ID = "chinese-stage-life-1";
export const LIFE1_EN_OLD = "/uploads/content/life-comics/life-1-en.png";
export const LIFE1_EN_NEW = "/uploads/content/life-comics/life-1-en-v2.png";

export interface PatchStore {
  /** 該關第一個漫畫頁；沒有回傳 null */
  findComicPage(stageId: string): Promise<{ id: string; comicImagesEn: string | null } | null>;
  setComicEn(pageId: string, json: string): Promise<void>;
}
export interface PatchEnv {
  /** 確保新圖檔在固定 uploads 內（缺才複製、不覆蓋）；成功回傳 true */
  ensureFile(publicUrl: string): boolean;
}

export type PatchStatus = "updated" | "already" | "kept-admin-change" | "no-comic-page" | "missing-file";
export interface PatchResult {
  status: PatchStatus;
  message: string;
}

const urlsOf = (json: string | null): string[] => {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map((x) => String(x?.url ?? "")).filter(Boolean) : [];
  } catch {
    return ["<無法解析>"];
  }
};

export async function patchLife1EnglishComic(store: PatchStore, env: PatchEnv): Promise<PatchResult> {
  const page = await store.findComicPage(LIFE1_STAGE_ID);
  if (!page) return { status: "no-comic-page", message: "生活第 1 關沒有漫畫頁，略過（可用 npm run db:restore-life 補）。" };
  const urls = urlsOf(page.comicImagesEn);
  if (urls.length === 1 && urls[0] === LIFE1_EN_NEW) return { status: "already", message: "生活第 1 關英文漫畫已經是新圖，不需要更新。" };
  const isOld = urls.length === 1 && urls[0] === LIFE1_EN_OLD;
  if (urls.length > 0 && !isOld) {
    return { status: "kept-admin-change", message: `生活第 1 關英文漫畫目前是 ${urls.join("、")}（不是內建舊圖，可能是你在後台換過），保留不動。` };
  }
  if (!env.ensureFile(LIFE1_EN_NEW)) return { status: "missing-file", message: "找不到新圖檔（prisma/assets 內的 life-1-en-v2.png），未更新。" };
  await store.setComicEn(page.id, JSON.stringify([{ url: LIFE1_EN_NEW, width: 1200, height: 1400 }]));
  return { status: "updated", message: `生活第 1 關英文漫畫已更換為新圖（${LIFE1_EN_NEW}）；舊檔保留在 uploads，沒有刪除。` };
}
