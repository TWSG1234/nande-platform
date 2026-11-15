/**
 * 搜尋用的文字正規化與斷詞（不依賴任何外部服務或斷詞套件）。
 * - 中文：去掉語助詞／疑問詞後，取「連續兩字」(bigram) 為主、單字為輔。這樣使用者問法和資料標題不需要完全一樣。
 * - 英文：小寫、去掉常見虛詞、簡單去複數。
 */

export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/臺/g, "台")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const CJK = /[㐀-鿿]/;
const CJK_RUN = /[㐀-鿿]+/g;

/** 問句裡不帶主題資訊的詞（長的先換）。只用來「去雜訊」，不是觸發規則。 */
const ZH_STOP = [
  "我想知道", "我想要", "請問一下", "請問", "想知道", "有沒有", "是不是", "能不能", "可不可以", "為什麼", "怎麼樣", "是什麼",
  "什麼", "怎麼", "怎樣", "如何", "哪裡", "哪邊", "可以", "能夠", "一下", "為何", "知道", "告訴我", "幫我", "想要",
  "嗎", "呢", "吧", "啊", "喔", "哦", "呀", "的", "了", "我", "你", "妳", "想", "要", "請", "在", "有", "是", "和", "跟", "與", "及", "或", "都", "就", "也", "很", "會", "能", "去", "到", "給",
].sort((a, b) => b.length - a.length);

const EN_STOP = new Set([
  "the", "a", "an", "how", "do", "does", "did", "to", "what", "where", "when", "is", "are", "was", "can", "could", "you", "me", "my", "i",
  "in", "on", "of", "for", "and", "or", "it", "this", "that", "there", "with", "about", "want", "know", "get", "go", "please", "tell", "need", "should",
  "would", "will", "am", "be", "we", "us", "your", "at", "by", "from", "some", "any", "which", "who",
]);

export function stemEn(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("es") && /(s|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export interface QueryTerm {
  term: string;
  /** 重要程度（連續兩字 1、單字較低） */
  w: number;
}

/** 把使用者的問題拆成搜尋詞。 */
export function queryTerms(query: string): QueryTerm[] {
  let q = normalize(query);
  for (const s of ZH_STOP) q = q.split(s).join(" ");
  const out = new Map<string, number>();
  const put = (t: string, w: number) => {
    if (!t) return;
    out.set(t, Math.max(out.get(t) ?? 0, w));
  };
  for (const run of q.match(CJK_RUN) ?? []) {
    if (run.length === 1) {
      put(run, 0.7);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) put(run.slice(i, i + 2), 1);
    if (run.length >= 3 && run.length <= 6) put(run, 1.2); // 整段也算（例如「午休時間」）
    for (const ch of run) put(ch, 0.2);
  }
  const latin = q.replace(CJK_RUN, " ").split(" ").filter(Boolean);
  for (const word of latin) {
    if (EN_STOP.has(word) || word.length < 2) continue;
    put(/^\d+$/.test(word) ? word : stemEn(word), 1);
  }
  return [...out].map(([term, w]) => ({ term, w }));
}

/** 英文單字集合（供比對用）。 */
export function latinWords(text: string): string[] {
  return text.replace(CJK_RUN, " ").split(" ").filter(Boolean).map(stemEn);
}

/** 在已正規化的文字中，詞出現幾次。CJK 用子字串；英文單字 <4 字要完全相同、≥4 字可當字首（school → schools）。 */
export function countOccurrences(text: string, words: string[], term: string): number {
  if (!text) return 0;
  if (CJK.test(term)) {
    let n = 0;
    let i = text.indexOf(term);
    while (i !== -1 && n < 5) {
      n++;
      i = text.indexOf(term, i + term.length);
    }
    return n;
  }
  if (term.includes(" ")) return text.includes(term) ? 1 : 0;
  let n = 0;
  for (const w of words) if (w === term || (term.length >= 4 && w.startsWith(term))) n++;
  return n;
}

function bigrams(s: string): Set<string> {
  const t = s.replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

/** 標題相似度（Dice 係數，0～1）。 */
export function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}
