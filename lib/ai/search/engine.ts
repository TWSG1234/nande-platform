/**
 * 威洛的資料搜尋引擎（純函式；不連資料庫、不呼叫任何外部服務，所以同一份程式在本機與正式環境行為一致）。
 *
 * 評分方法（欄位加權的詞頻 × 稀有度）：
 *  1. 問題拆成搜尋詞（lib/ai/search/normalize.ts：中文兩字詞為主、單字為輔；英文去虛詞與複數）。
 *  2. 同義詞／口語概念展開（synonyms.ts）：只加「權重較低」的展開詞，且展開詞要在真實資料裡找得到才有分數。
 *  3. 每筆資料依欄位加權計分：標題 3、標籤 2.5、分類 1.5、內文 1、詳細內容 0.6；
 *     詞越稀有（IDF）分數越高，同一個詞重複出現有上限（避免長文章佔便宜）。
 *  4. 另加「標題相似度」(Dice) 與「標題直接出現在問題中」的加分。
 *  5. coverage（涵蓋率）＝ 問題裡有多少比例的重要詞在這筆資料中找得到（同義詞算 7 折）。
 * 排序：分數高→低；同分時標題較短（較精準）、再依類型優先順序。同一筆資料只出現一次。
 * relevance 只是「這筆資料和問題有多相關」的內部指標，不是 AI 的信心程度。
 */
import { CJK, countOccurrences, dice, latinWords, normalize, queryTerms, type QueryTerm } from "./normalize";
import { CONCEPTS } from "./synonyms";

export type DocKind = "life" | "campus" | "calendar" | "chinese" | "knowledge" | "rule";

export interface SearchDoc {
  id: string;
  kind: DocKind;
  categoryZh: string;
  categoryEn: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  /** 較長的補充內容（只參與比對與「詳細資訊」） */
  extraZh?: string;
  extraEn?: string;
  tags: string[];
  /** 直接顯示的答案文字（威洛常見回覆用；不參與比對，避免導覽式的回覆內容干擾排序） */
  answerZh?: string;
  answerEn?: string;
  /** 站內連結；沒有適當頁面就不給 */
  url?: string;
}

export type SearchMode = "high" | "candidates" | "related" | "none";

export interface ScoredDoc {
  doc: SearchDoc;
  score: number;
  coverage: number;
  /** 0～1，相關程度（內部指標，不是 AI 信心） */
  relevance: number;
  /** 沒有直接命中，是因為「同分類擴大搜尋」才列入 */
  viaExpansion?: boolean;
}

export interface SearchOutcome {
  mode: SearchMode;
  results: ScoredDoc[];
  terms: string[];
  synonymTerms: string[];
}

const FIELD_W = { title: 3, tags: 2.5, category: 1.5, body: 1, extra: 0.6 };
const KIND_ORDER: Record<DocKind, number> = { knowledge: 0, rule: 1, life: 2, campus: 3, calendar: 4, chinese: 5 };
const SYN_FACTOR = 0.55;
const MIN_COVERAGE = 0.12;
const NOISE_RATIO = 0.15;
const DOMINANCE = 2.5;

interface Prepared {
  doc: SearchDoc;
  title: string;
  tags: string;
  category: string;
  body: string;
  extra: string;
  all: string;
  words: Record<"title" | "tags" | "category" | "body" | "extra", string[]>;
}

function prepare(doc: SearchDoc): Prepared {
  const title = normalize(`${doc.titleZh} ${doc.titleEn}`);
  const tags = normalize(doc.tags.join(" "));
  const category = normalize(`${doc.categoryZh} ${doc.categoryEn}`);
  const body = normalize(`${doc.bodyZh} ${doc.bodyEn}`);
  const extra = normalize(`${doc.extraZh ?? ""} ${doc.extraEn ?? ""}`);
  return {
    doc,
    title,
    tags,
    category,
    body,
    extra,
    all: `${title} ${tags} ${category} ${body} ${extra}`,
    words: { title: latinWords(title), tags: latinWords(tags), category: latinWords(category), body: latinWords(body), extra: latinWords(extra) },
  };
}

const sat = (n: number) => (n > 0 ? 1 + 0.3 * Math.min(n - 1, 3) : 0);

/** 找出問題裡出現的概念，回傳展開詞（含是由哪些原詞觸發）。 */
function expandConcepts(query: string, exact: QueryTerm[]): { term: string; sources: string[] }[] {
  const q = normalize(query);
  const qWords = new Set(latinWords(q));
  const out = new Map<string, Set<string>>();
  for (const c of CONCEPTS) {
    const hits = c.triggers.map(normalize).filter((t) => (CJK.test(t) ? q.includes(t) : t.includes(" ") ? q.includes(t) : qWords.has(t)));
    if (hits.length === 0) continue;
    const sources = new Set<string>();
    for (const h of hits) for (const e of exact) if (CJK.test(e.term) ? h.includes(e.term) : h === e.term) sources.add(e.term);
    for (const e of c.expands.map(normalize)) {
      if (!out.has(e)) out.set(e, new Set());
      for (const s of sources) out.get(e)!.add(s);
    }
  }
  return [...out].map(([term, s]) => ({ term, sources: [...s] }));
}

export interface SearchOptions {
  limit?: number;
}

export function search(query: string, docs: SearchDoc[], opt: SearchOptions = {}): SearchOutcome {
  const limit = Math.min(Math.max(opt.limit ?? 5, 1), 5);
  const exact = queryTerms(query);
  const exactSet = new Set(exact.map((t) => t.term));
  const syn = expandConcepts(query, exact).filter((s) => !exactSet.has(s.term));
  const empty: SearchOutcome = { mode: "none", results: [], terms: exact.map((t) => t.term), synonymTerms: syn.map((s) => s.term) };
  if (exact.length === 0 && syn.length === 0) return empty;

  const prepared = docs.map(prepare);
  const N = Math.max(prepared.length, 1);
  const idfCache = new Map<string, number>();
  const idf = (term: string) => {
    let v = idfCache.get(term);
    if (v === undefined) {
      let df = 0;
      for (const p of prepared) if (countOccurrences(p.all, latinWords(p.all), term) > 0) df++;
      v = Math.log(1 + N / (1 + df));
      idfCache.set(term, v);
    }
    return v;
  };

  const qNorm = normalize(query);
  const slots = exact.map((t) => ({ term: t.term, weight: t.w * idf(t.term) }));
  const slotTotal = slots.reduce((a, s) => a + s.weight, 0) || 1;

  const scored: ScoredDoc[] = [];
  for (const p of prepared) {
    let score = 0;
    const matched = new Map<string, number>(); // 原詞 → 命中程度 (0～1)
    const termScore = (term: string, w: number, factor: number) => {
      let s = 0;
      for (const f of ["title", "tags", "category", "body", "extra"] as const) {
        const n = countOccurrences(p[f], p.words[f], term);
        if (n) s += FIELD_W[f] * sat(n);
      }
      if (s > 0) score += w * idf(term) * s * factor;
      return s > 0;
    };
    for (const t of exact) if (termScore(t.term, t.w, 1)) matched.set(t.term, 1);
    for (const sTerm of syn) {
      if (termScore(sTerm.term, 0.8, SYN_FACTOR)) for (const src of sTerm.sources) matched.set(src, Math.max(matched.get(src) ?? 0, 1 - SYN_FACTOR * 0.8));
    }
    if (score <= 0) continue;
    // 標題相似度與標題直接出現在問題中
    const titleZhNorm = normalize(p.doc.titleZh);
    const titleEnNorm = normalize(p.doc.titleEn);
    score += 4 * Math.max(dice(qNorm, titleZhNorm), dice(qNorm, titleEnNorm));
    for (const t of [titleZhNorm, titleEnNorm]) if (t.length >= 2 && qNorm.includes(t)) score += 3;
    const cat = normalize(p.doc.categoryZh);
    if (cat.length >= 2 && qNorm.includes(cat)) score += 1.5;

    let covered = 0;
    for (const s of slots) covered += s.weight * (matched.get(s.term) ?? 0);
    const coverage = Math.min(covered / slotTotal, 1);
    if (coverage < MIN_COVERAGE) continue;
    scored.push({ doc: p.doc, score, coverage, relevance: 0 });
  }

  // 同一筆資料（相同類型＋標題＋分類）只留一個
  const seen = new Set<string>();
  const unique = scored
    .sort(rank)
    .filter((s) => {
      const key = `${s.doc.id}|${s.doc.kind}:${s.doc.titleZh}:${s.doc.titleEn}:${s.doc.categoryZh}`;
      if (seen.has(s.doc.id) || seen.has(key)) return false;
      seen.add(s.doc.id);
      seen.add(key);
      return true;
    });

  if (unique.length === 0) return empty;
  const maxScore = unique[0]!.score;
  for (const u of unique) u.relevance = Math.min(1, u.coverage * 0.7 + (u.score / maxScore) * 0.3);

  // 分數遠低於第一名的零星命中視為雜訊，不列入候選（第一名一定保留）
  let results = unique.filter((u, i) => i === 0 || u.score >= maxScore * NOISE_RATIO).slice(0, limit);

  // 結果太少：擴大到「同分類」的其他資料（排在後面，標示為擴大搜尋）
  if (results.length < 3) {
    const cats = new Set(results.map((r) => `${r.doc.kind}:${r.doc.categoryZh}`));
    const have = new Set(results.map((r) => r.doc.id));
    const siblings = docs
      .filter((d) => !have.has(d.id) && cats.has(`${d.kind}:${d.categoryZh}`) && d.kind !== "rule" && d.kind !== "knowledge")
      .slice(0, 3 - results.length)
      .map<ScoredDoc>((d) => ({ doc: d, score: 0, coverage: 0, relevance: 0.1, viaExpansion: true }));
    results = [...results, ...siblings];
  }

  const top = results[0]!;
  const second = results[1];
  let mode: SearchMode;
  const lead = !second || second.viaExpansion || top.score >= DOMINANCE * second.score;
  if (!top.viaExpansion && ((top.relevance >= 0.75 && (!second || second.viaExpansion || top.score >= 1.5 * second.score)) || (lead && top.coverage >= 0.2))) mode = "high";
  else if (results.filter((r) => !r.viaExpansion && r.relevance >= 0.3).length >= 2) mode = "candidates";
  else mode = "related";

  if (mode === "high") results = results.slice(0, Math.min(3, limit));
  return { mode, results, terms: empty.terms, synonymTerms: empty.synonymTerms };
}

function rank(a: ScoredDoc, b: ScoredDoc): number {
  if (b.score !== a.score) return b.score - a.score;
  const la = a.doc.titleZh.length;
  const lb = b.doc.titleZh.length;
  if (la !== lb) return la - lb;
  return KIND_ORDER[a.doc.kind] - KIND_ORDER[b.doc.kind];
}
