/**
 * SVG 動畫分析（純函式，可獨立測試）。
 *
 * 前台用 <img> 載入 SVG（為了安全不執行腳本），瀏覽器沒有「SVG 動畫結束」事件，
 * 也不能從外部控制它。因此只接受「能由檔案內容判定結束時間、且結束後會停在最後狀態」的動畫：
 *   - SMIL（<animate>、<animateTransform>、<animateMotion>、<set>）：必須有限的 dur／repeatCount／repeatDur、
 *     begin 只能是時間值（不可是點擊等事件）、fill="freeze"。
 *   - CSS animation：iteration-count 不可 infinite、必須 animation-fill-mode: forwards／both。
 *   - 沒有任何動畫 → 靜態 SVG，直接顯示。
 * 無限循環、事件觸發、沒有 freeze 的動畫一律拒絕，並用中文說明原因與修正方式——
 * 不會一邊讓它無限循環、一邊宣稱會停在最後一幀。
 */
export type SvgAnimInfo =
  | { kind: "static"; durationMs: 0 }
  | { kind: "animated"; durationMs: number }
  | { kind: "unsupported"; reason: string };

const MAX_SECONDS = 60;

/** SMIL 時間值（秒）。只接受 0 以上的「時鐘值」；其他（事件、id.begin、indefinite…）回傳 null。 */
export function parseClock(v: string): number | null {
  const s = v.trim();
  let m = /^\+?(\d+(?:\.\d+)?|\.\d+)(h|min|s|ms)?$/.exec(s);
  if (m) {
    const n = parseFloat(m[1]!);
    const u = m[2] ?? "s";
    return u === "h" ? n * 3600 : u === "min" ? n * 60 : u === "ms" ? n / 1000 : n;
  }
  m = /^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(s);
  if (m) return (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2]!, 10) * 60 + parseFloat(m[3]!);
  return null;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1]!.toLowerCase()] = (m[3] ?? m[4] ?? "").trim();
  return out;
}

function parseTimeToken(t: string): number | null {
  // CSS：1s、300ms、.5s
  const m = /^(\d*\.?\d+)(s|ms)$/i.exec(t);
  if (!m) return null;
  return m[2]!.toLowerCase() === "ms" ? parseFloat(m[1]!) / 1000 : parseFloat(m[1]!);
}

export function analyzeSvgAnimation(svgText: string): SvgAnimInfo {
  const text = svgText.replace(/^﻿/, "").replace(/<!--[\s\S]*?-->/g, "");
  let endSec = 0;
  let animated = false;
  const bad = (reason: string): SvgAnimInfo => ({ kind: "unsupported", reason });

  // ── SMIL ──
  const smilRe = /<\s*(animate|animatetransform|animatemotion|animatecolor|set)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = smilRe.exec(text))) {
    animated = true;
    const name = m[1]!.toLowerCase();
    const a = attrs(m[2]!);
    const label = `<${m[1]}>`;
    if (a["fill"] !== "freeze") return bad(`SVG 的 ${label} 沒有設定 fill="freeze"，動畫播完會跳回起始畫面，無法停在最後狀態。請在每個動畫元素加上 fill="freeze"。`);
    if (a["end"] !== undefined) return bad(`SVG 的 ${label} 使用了 end 屬性，無法判定結束時間。請移除 end，改用 dur 與 repeatCount。`);
    const beginList = (a["begin"] ?? "0").split(";");
    let begin = 0;
    for (const b of beginList) {
      const sec = parseClock(b);
      if (sec === null) return bad(`SVG 的 ${label} 的 begin（${b.trim()}）不是單純的時間值（例如 0s、1.5s）。點擊、其他動畫結束時才開始等形式無法判定結束時間，請改成固定時間。`);
      begin = Math.max(begin, sec);
    }
    let active: number;
    if (name === "set" && a["dur"] === undefined) {
      active = 0; // <set> 沒有 dur：在 begin 之後一直維持設定值
    } else {
      const dur = a["dur"] !== undefined ? parseClock(a["dur"]) : null;
      if (dur === null || dur <= 0) return bad(`SVG 的 ${label} 沒有明確的 dur（持續時間），或設成 indefinite，無法判定結束時間。請設定例如 dur="2s"。`);
      const rc = a["repeatcount"];
      let count = 1;
      if (rc !== undefined) {
        if (rc.toLowerCase() === "indefinite") return bad(`SVG 的 ${label} 設成 repeatCount="indefinite"（無限循環），不會停在最後一幀。請改成有限次數，例如 repeatCount="1"。`);
        count = parseFloat(rc);
        if (!isFinite(count) || count <= 0) return bad(`SVG 的 ${label} 的 repeatCount（${rc}）不正確。`);
      }
      active = dur * count;
      const rd = a["repeatdur"];
      if (rd !== undefined) {
        if (rd.toLowerCase() === "indefinite") return bad(`SVG 的 ${label} 設成 repeatDur="indefinite"（無限循環），不會停在最後一幀。`);
        const r = parseClock(rd);
        if (r === null) return bad(`SVG 的 ${label} 的 repeatDur（${rd}）不是有效的時間值。`);
        active = rd !== undefined && a["repeatcount"] === undefined ? r : Math.min(active, r);
      }
    }
    endSec = Math.max(endSec, begin + active);
  }

  // ── CSS animation（<style> 區塊與行內 style 屬性）──
  const unitRe = /\{([^{}]*)\}|style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/g;
  while ((m = unitRe.exec(text))) {
    const body = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!/animation/i.test(body)) continue;
    const decls = body.split(";").map((d) => d.trim()).filter(Boolean);
    const props: Record<string, string> = {};
    for (const d of decls) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      const k = d.slice(0, i).trim().toLowerCase().replace(/^-(webkit|moz|ms|o)-/, "");
      if (k.startsWith("animation")) props[k] = d.slice(i + 1).trim().toLowerCase();
    }
    if (Object.keys(props).length === 0) continue;
    const nameVal = props["animation-name"];
    if (props["animation"] === undefined && (nameVal === undefined || nameVal === "none")) continue;
    animated = true;
    const infiniteMsg = "SVG 的 CSS 動畫設成 infinite（無限循環），不會停在最後一幀。請改成有限次數，例如 animation-iteration-count: 1。";
    const fillMsg = "SVG 的 CSS 動畫沒有設定 animation-fill-mode: forwards（或 both），播完會跳回起始畫面，無法停在最後狀態。";
    let blockEnd = 0;
    const shorthand = props["animation"];
    if (shorthand !== undefined) {
      for (const part of shorthand.split(/,(?![^(]*\))/)) {
        const tokens = part.trim().split(/\s+/).filter(Boolean);
        if (tokens.includes("infinite")) return bad(infiniteMsg);
        if (!tokens.includes("forwards") && !tokens.includes("both") && !/forwards|both/.test(props["animation-fill-mode"] ?? "")) return bad(fillMsg);
        const times = tokens.map(parseTimeToken).filter((t): t is number => t !== null);
        const count = tokens.map((t) => (/^\d*\.?\d+$/.test(t) ? parseFloat(t) : NaN)).find((n) => !isNaN(n)) ?? 1;
        blockEnd = Math.max(blockEnd, (times[1] ?? 0) + (times[0] ?? 0) * count);
      }
    } else {
      const ic = props["animation-iteration-count"] ?? "1";
      if (/infinite/.test(ic)) return bad(infiniteMsg);
      if (!/forwards|both/.test(props["animation-fill-mode"] ?? "")) return bad(fillMsg);
      const dur = Math.max(...(props["animation-duration"] ?? "0s").split(",").map((t) => parseTimeToken(t.trim()) ?? 0));
      const delay = Math.max(...(props["animation-delay"] ?? "0s").split(",").map((t) => parseTimeToken(t.trim()) ?? 0));
      const cnt = Math.max(...ic.split(",").map((t) => parseFloat(t) || 1));
      blockEnd = delay + dur * cnt;
    }
    endSec = Math.max(endSec, blockEnd);
  }

  if (!animated) return { kind: "static", durationMs: 0 };
  if (endSec > MAX_SECONDS) return bad(`SVG 動畫總長度超過 ${MAX_SECONDS} 秒，請縮短。`);
  return { kind: "animated", durationMs: Math.round(endSec * 1000) };
}
