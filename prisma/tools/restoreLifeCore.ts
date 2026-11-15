/**
 * 生活區資料「只補缺、不覆蓋」的比對／恢復核心。
 * 與資料庫連線方式無關：由呼叫端提供 Store（Prisma 版在 restoreLife.ts，測試用記憶體版）。
 *
 * 規則（全部都是「只新增」）：
 * - 關卡不存在 → 建立；名稱（titleZh）是空的 → 補上；已有名稱但不同 → 只列差異，不改。
 * - 漫畫頁不存在 → 建立；中文版／英文版圖片欄位是空的 → 補上；已有但不同 → 只列差異，不改。
 * - 單字頁不存在 → 建立；單字以「同一頁 + 中文」判斷，缺少的才新增；已存在但拼音／英文不同 → 只列差異，不改。
 * - 不在名單內的現有單字、題目、校園資料、學習進度：完全不碰（只在報告中計數）。
 * - 絕不刪除。
 */
import type { LifeStage } from "../data/lifeVocabulary";

export interface StageRow {
  id: string;
  titleZh: string;
  isPublished: boolean;
}
export interface PageRow {
  id: string;
  stageId: string;
  type: string;
  order: number;
  isPublished: boolean;
  comicImages: string | null;
  comicImagesEn: string | null;
  allowFlip: boolean;
}
export interface WordRow {
  id: string;
  pageId: string;
  hanzi: string;
  pinyin: string;
  english: string;
  order: number;
}

export interface Store {
  getStage(id: string): Promise<StageRow | null>;
  listPages(stageId: string): Promise<PageRow[]>;
  listWords(pageId: string): Promise<WordRow[]>;
  countQuestions(stageId: string): Promise<number>;
  createStage(row: { id: string; level: number; titleZh: string }): Promise<void>;
  setStageTitle(id: string, titleZh: string): Promise<void>;
  createPage(row: PageRow): Promise<void>;
  setComicFields(id: string, fields: { comicImages?: string; comicImagesEn?: string }): Promise<void>;
  createWord(row: Omit<WordRow, "id">): Promise<void>;
}

export interface RestoreOptions {
  apply: boolean;
  /** 檢查圖片檔是否真的存在於 public/ 底下；測試可注入。 */
  fileExists: (publicUrl: string) => boolean;
  width?: number;
  height?: number;
}

export interface RestoreResult {
  lines: string[];
  summary: {
    stagesCreated: number;
    titlesFilled: number;
    comicPagesCreated: number;
    comicsFilled: number;
    vocabPagesCreated: number;
    wordsAdded: number;
    wordsAlreadyOk: number;
    differences: number;
    notes: number;
  };
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const parseUrls = (json: string | null): string[] => {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map((x) => String(x?.url ?? "")).filter(Boolean) : [];
  } catch {
    return [];
  }
};

export async function restoreLife(store: Store, stages: LifeStage[], opt: RestoreOptions): Promise<RestoreResult> {
  const W = opt.width ?? 1200;
  const H = opt.height ?? 1400;
  const lines: string[] = [];
  const log = (s = "") => lines.push(s);
  const s = {
    stagesCreated: 0,
    titlesFilled: 0,
    comicPagesCreated: 0,
    comicsFilled: 0,
    vocabPagesCreated: 0,
    wordsAdded: 0,
    wordsAlreadyOk: 0,
    differences: 0,
    notes: 0,
  };
  const verb = opt.apply ? "已" : "將會";
  const diff = (m: string) => {
    s.differences++;
    log(`  ⚠ 差異（未改動）：${m}`);
  };
  const note = (m: string) => {
    s.notes++;
    log(`  ℹ ${m}`);
  };

  for (const st of stages) {
    const id = `chinese-stage-life-${st.level}`;
    const want = clean(st.titleZh);
    log(`\n【生活第 ${st.level} 關】`);

    // 1) 關卡
    let stage = await store.getStage(id);
    if (!stage) {
      log(`  ＋ ${verb}建立關卡「${want}」`);
      if (opt.apply) await store.createStage({ id, level: st.level, titleZh: want });
      s.stagesCreated++;
      stage = { id, titleZh: want, isPublished: true };
    } else if (!clean(stage.titleZh)) {
      log(`  ＋ ${verb}補上空白的關卡名稱：「${want}」`);
      if (opt.apply) await store.setStageTitle(id, want);
      s.titlesFilled++;
    } else if (clean(stage.titleZh) !== want) {
      diff(`關卡名稱 現有「${stage.titleZh}」／ZIP「${want}」`);
    } else {
      log(`  ✓ 關卡名稱一致：「${want}」`);
    }
    if (!stage.isPublished) note("這一關在資料庫中是「未發布」狀態，前台不會顯示；本工具不改發布狀態，請到後台確認。");

    // 2) 漫畫
    const pages = await store.listPages(id);
    const comics = pages.filter((p) => p.type === "comic").sort((a, b) => a.order - b.order);
    const zhUrl = `/uploads/content/life-comics/life-${st.level}-zh.png`;
    const enUrl = `/uploads/content/life-comics/life-${st.level}-en.png`;
    const zhJson = JSON.stringify([{ url: zhUrl, width: W, height: H }]);
    const enJson = JSON.stringify([{ url: enUrl, width: W, height: H }]);
    const zhOk = opt.fileExists(zhUrl);
    const enOk = opt.fileExists(enUrl);
    if (!zhOk || !enOk) note(`public${!zhOk ? zhUrl : ""}${!zhOk && !enOk ? "、" : ""}${!enOk ? enUrl : ""} 這個專案資料夾裡找不到圖檔；缺圖的那一面不會寫入。`);
    if (comics.length === 0) {
      if (zhOk || enOk) {
        log(`  ＋ ${verb}建立漫畫頁（中文版${zhOk ? "✓" : "✗缺圖"}／英文版${enOk ? "✓" : "✗缺圖"}）`);
        if (opt.apply) {
          const first = pages.slice().sort((a, b) => a.order - b.order)[0];
          await store.createPage({
            id: `chinese-page-life-${st.level}-comic`,
            stageId: id,
            type: "comic",
            order: first ? first.order - 1 : 0,
            isPublished: true,
            comicImages: zhOk ? zhJson : null,
            comicImagesEn: enOk ? enJson : null,
            allowFlip: zhOk && enOk,
          });
        }
        s.comicPagesCreated++;
      }
    } else {
      const c = comics[0]!;
      if (comics.length > 1) note(`這一關有 ${comics.length} 個漫畫頁，只檢查第一個。`);
      const fill: { comicImages?: string; comicImagesEn?: string } = {};
      for (const [label, cur, json, url, ok, key] of [
        ["中文版", c.comicImages, zhJson, zhUrl, zhOk, "comicImages"],
        ["英文版", c.comicImagesEn, enJson, enUrl, enOk, "comicImagesEn"],
      ] as const) {
        const urls = parseUrls(cur);
        if (urls.length === 0) {
          if (ok) {
            log(`  ＋ ${verb}補上空白的${label}漫畫`);
            fill[key] = json;
            s.comicsFilled++;
          }
        } else if (!urls.includes(url)) {
          diff(`${label}漫畫 現有 ${urls.join("、")}／ZIP ${url}（可能是你後來在後台換過，保留現有）`);
        } else {
          log(`  ✓ ${label}漫畫已存在`);
        }
      }
      if (opt.apply && (fill.comicImages || fill.comicImagesEn)) await store.setComicFields(c.id, fill);
      const hasBoth = parseUrls(fill.comicImages ?? c.comicImages).length > 0 && parseUrls(fill.comicImagesEn ?? c.comicImagesEn).length > 0;
      if (hasBoth && !c.allowFlip) note("中英文漫畫都有，但這頁的「允許翻轉」是關閉的（後台設定）；本工具不改，請到後台確認。");
    }

    // 3) 單字
    let vocab = pages.filter((p) => p.type === "vocabulary").sort((a, b) => a.order - b.order)[0];
    let vocabId = vocab?.id ?? `chinese-page-life-${st.level}-vocab`;
    let existing: WordRow[] = [];
    if (!vocab) {
      log(`  ＋ ${verb}建立單字頁`);
      if (opt.apply) {
        const last = pages.slice().sort((a, b) => b.order - a.order)[0];
        await store.createPage({ id: vocabId, stageId: id, type: "vocabulary", order: last ? last.order + 1 : 0, isPublished: true, comicImages: null, comicImagesEn: null, allowFlip: true });
      }
      s.vocabPagesCreated++;
    } else {
      existing = await store.listWords(vocab.id);
    }
    let maxOrder = existing.reduce((m, w) => Math.max(m, w.order), -1);
    const used = new Set<string>();
    let added = 0;
    let ok = 0;
    for (const [i, [hanzi, pinyin, english]] of st.words.entries()) {
      const hit = existing.find((w) => clean(w.hanzi) === hanzi && !used.has(w.id));
      if (hit) {
        used.add(hit.id);
        ok++;
        if (clean(hit.pinyin) !== pinyin || clean(hit.english) !== english) {
          diff(`單字「${hanzi}」 現有 ${hit.pinyin} / ${hit.english}／ZIP ${pinyin} / ${english}`);
        }
      } else {
        const order = existing.length === 0 ? i : ++maxOrder;
        if (opt.apply) await store.createWord({ pageId: vocabId, hanzi, pinyin, english, order });
        added++;
        log(`  ＋ ${verb}新增單字「${hanzi}」（${pinyin} / ${english}）`);
      }
    }
    s.wordsAdded += added;
    s.wordsAlreadyOk += ok;
    const extras = existing.filter((w) => !used.has(w.id));
    log(`  單字：名單 ${st.words.length}，現有已對上 ${ok}，${verb}新增 ${added}${extras.length ? `，不在名單的現有單字 ${extras.length} 個（保留不動）：${extras.map((w) => w.hanzi).join("、")}` : ""}`);

    // 4) 題目：ZIP 沒有題目資料，只回報現況
    const q = await store.countQuestions(id);
    log(`  題目：ZIP 內沒有生活區題目資料，不處理；資料庫目前有 ${q} 題（原樣保留）。`);
  }
  return { lines, summary: s };
}
