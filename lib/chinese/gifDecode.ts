/**
 * 純 TypeScript 的 GIF 解碼器＋逐格合成器（不依賴任何套件、不碰 DOM，可在 Node 單獨測試）。
 *
 * 為什麼需要它：瀏覽器的 <img src="x.gif"> 沒有「播放結束」事件，也不能要求停在最後一幀。
 * 所以前台改成：解出每一格 → 依各格的延遲自己排程繪製到 <canvas> → 最後一格畫完就停（不循環）。
 * 「停在最後一幀」因此是程式實際控制的結果，不是 CSS 假設。
 */
export class GifDecodeError extends Error {}

export type GifFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 這一格的像素（RGBA，只有 w×h 範圍；透明處 alpha=0） */
  rgba: Uint8ClampedArray;
  /** 顯示時間（毫秒）。已套用瀏覽器慣例：0～10ms 視為 100ms */
  delayMs: number;
  /** 0/1＝保留；2＝還原為透明；3＝還原為上一個狀態 */
  disposal: number;
};

export type DecodedGif = {
  width: number;
  height: number;
  frames: GifFrame[];
  /** 全部格數的顯示時間總和（毫秒） */
  totalMs: number;
};

export const GIF_LIMITS = { maxSide: 4096, maxFrames: 2000, maxPixelsTotal: 400_000_000 };

function lzwDecode(minCodeSize: number, data: Uint8Array, pixelCount: number): Uint8Array {
  if (minCodeSize < 1 || minCodeSize > 11) throw new GifDecodeError("GIF 壓縮參數不正確。");
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let size = minCodeSize + 1;
  let mask = (1 << size) - 1;
  let next = eoi + 1;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  const out = new Uint8Array(pixelCount);
  let op = 0;
  let bits = 0;
  let acc = 0;
  let prev = -1;
  let first = 0;
  let pos = 0;
  while (op < pixelCount) {
    while (bits < size) {
      if (pos >= data.length) return out; // 資料提早結束：剩下的像素維持 0（與瀏覽器容錯方式相同）
      acc |= data[pos++]! << bits;
      bits += 8;
    }
    const code = acc & mask;
    acc >>>= size;
    bits -= size;
    if (code === clear) {
      size = minCodeSize + 1;
      mask = (1 << size) - 1;
      next = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;
    if (prev === -1) {
      if (code >= clear) throw new GifDecodeError("GIF 影像資料損壞。");
      out[op++] = suffix[code]!;
      prev = code;
      first = code;
      continue;
    }
    let cur = code;
    let sp = 0;
    if (code >= next) {
      if (code > next) throw new GifDecodeError("GIF 影像資料損壞。");
      stack[sp++] = first;
      cur = prev;
    }
    while (cur >= clear) {
      stack[sp++] = suffix[cur]!;
      cur = prefix[cur]!;
    }
    first = suffix[cur]!;
    stack[sp++] = first;
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = first;
      next++;
      if ((next & mask) === 0 && next < 4096) {
        size++;
        mask = (1 << size) - 1;
      }
    }
    prev = code;
    while (sp > 0 && op < pixelCount) out[op++] = stack[--sp]!;
  }
  return out;
}

export function decodeGif(input: Uint8Array): DecodedGif {
  const b = input;
  if (b.length < 13) throw new GifDecodeError("不是有效的 GIF。");
  const sig = String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!, b[4]!, b[5]!);
  if (sig !== "GIF87a" && sig !== "GIF89a") throw new GifDecodeError("不是有效的 GIF。");
  const width = b[6]! | (b[7]! << 8);
  const height = b[8]! | (b[9]! << 8);
  if (!width || !height || width > GIF_LIMITS.maxSide || height > GIF_LIMITS.maxSide) throw new GifDecodeError("GIF 尺寸不正確或太大。");
  const flags = b[10]!;
  let p = 13;
  let globalPalette: Uint8Array | null = null;
  if (flags & 0x80) {
    const n = 3 * (1 << ((flags & 7) + 1));
    if (p + n > b.length) throw new GifDecodeError("GIF 色盤損壞。");
    globalPalette = b.subarray(p, p + n);
    p += n;
  }

  const frames: GifFrame[] = [];
  let gce: { delay: number; transparent: number; disposal: number } = { delay: 0, transparent: -1, disposal: 0 };
  let pixelsTotal = 0;

  const skipSubBlocks = () => {
    while (p < b.length) {
      const n = b[p++]!;
      if (n === 0) return;
      p += n;
    }
  };

  loop: while (p < b.length) {
    const block = b[p++]!;
    switch (block) {
      case 0x3b:
        break loop;
      case 0x21: {
        const label = b[p++]!;
        if (label === 0xf9 && b[p] === 4) {
          const f = b[p + 1]!;
          gce = { disposal: (f >> 2) & 7, delay: b[p + 2]! | (b[p + 3]! << 8), transparent: f & 1 ? b[p + 4]! : -1 };
          p += 6; // size + 4 bytes + terminator
        } else {
          skipSubBlocks();
        }
        break;
      }
      case 0x2c: {
        if (p + 9 > b.length) throw new GifDecodeError("GIF 檔案不完整。");
        const x = b[p]! | (b[p + 1]! << 8);
        const y = b[p + 2]! | (b[p + 3]! << 8);
        const w = b[p + 4]! | (b[p + 5]! << 8);
        const h = b[p + 6]! | (b[p + 7]! << 8);
        const f = b[p + 8]!;
        p += 9;
        let palette = globalPalette;
        if (f & 0x80) {
          const n = 3 * (1 << ((f & 7) + 1));
          if (p + n > b.length) throw new GifDecodeError("GIF 色盤損壞。");
          palette = b.subarray(p, p + n);
          p += n;
        }
        const minCode = b[p++]!;
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (p < b.length) {
          const n = b[p++]!;
          if (n === 0) break;
          chunks.push(b.subarray(p, p + n));
          total += n;
          p += n;
        }
        const data = new Uint8Array(total);
        let o = 0;
        for (const c of chunks) {
          data.set(c, o);
          o += c.length;
        }
        if (!palette) throw new GifDecodeError("GIF 缺少色盤。");
        if (w === 0 || h === 0) {
          gce = { delay: 0, transparent: -1, disposal: 0 };
          break;
        }
        pixelsTotal += w * h;
        if (frames.length + 1 > GIF_LIMITS.maxFrames || pixelsTotal > GIF_LIMITS.maxPixelsTotal) throw new GifDecodeError("GIF 格數或總像素太多，請縮小後再試。");
        const idx = lzwDecode(minCode, data, w * h);
        const rgba = new Uint8ClampedArray(w * h * 4);
        // 交錯（interlaced）還原列順序
        const rowOf = (i: number): number => i;
        let order: number[] | null = null;
        if (f & 0x40) {
          order = [];
          for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) for (let r = start; r < h; r += step) order.push(r);
        }
        for (let i = 0; i < h; i++) {
          const dstRow = order ? order[i]! : rowOf(i);
          for (let col = 0; col < w; col++) {
            const ci = idx[i * w + col]!;
            const o4 = (dstRow * w + col) * 4;
            if (ci === gce.transparent || ci * 3 + 2 >= palette.length) {
              rgba[o4 + 3] = 0;
            } else {
              rgba[o4] = palette[ci * 3]!;
              rgba[o4 + 1] = palette[ci * 3 + 1]!;
              rgba[o4 + 2] = palette[ci * 3 + 2]!;
              rgba[o4 + 3] = 255;
            }
          }
        }
        const cs = gce.delay;
        frames.push({ x, y, w, h, rgba, delayMs: (cs <= 1 ? 10 : cs) * 10, disposal: gce.disposal });
        gce = { delay: 0, transparent: -1, disposal: 0 };
        break;
      }
      case 0x00:
        break;
      default:
        throw new GifDecodeError("GIF 檔案結構損壞。");
    }
  }
  if (frames.length === 0) throw new GifDecodeError("GIF 裡沒有任何影格。");
  return { width, height, frames, totalMs: frames.reduce((s, f) => s + f.delayMs, 0) };
}

/**
 * 逐格合成器：next() 依序回傳「這一格顯示時整張畫布的內容」（RGBA，width×height）。
 * 處理各格的 disposal（保留／清成透明／還原前一狀態），結果與瀏覽器一致。
 * 到最後一格後 done=true；reset() 回到第一格（用於「重新觀看」）。
 */
export class GifCompositor {
  readonly canvas: Uint8ClampedArray;
  private idx = 0;
  private pendingDispose: { frame: GifFrame; backup: Uint8ClampedArray | null } | null = null;

  constructor(readonly gif: DecodedGif) {
    this.canvas = new Uint8ClampedArray(gif.width * gif.height * 4);
  }

  get done(): boolean {
    return this.idx >= this.gif.frames.length;
  }
  get index(): number {
    return this.idx;
  }

  reset() {
    this.canvas.fill(0);
    this.idx = 0;
    this.pendingDispose = null;
  }

  private region(f: GifFrame): Uint8ClampedArray {
    const { width, height } = this.gif;
    const w = Math.max(0, Math.min(f.w, width - f.x));
    const h = Math.max(0, Math.min(f.h, height - f.y));
    const out = new Uint8ClampedArray(w * h * 4);
    for (let r = 0; r < h; r++) {
      const s = ((f.y + r) * width + f.x) * 4;
      out.set(this.canvas.subarray(s, s + w * 4), r * w * 4);
    }
    return out;
  }

  private applyDispose() {
    const d = this.pendingDispose;
    if (!d) return;
    this.pendingDispose = null;
    const { frame: f, backup } = d;
    const { width, height } = this.gif;
    const w = Math.max(0, Math.min(f.w, width - f.x));
    const h = Math.max(0, Math.min(f.h, height - f.y));
    for (let r = 0; r < h; r++) {
      const s = ((f.y + r) * width + f.x) * 4;
      if (f.disposal === 2) this.canvas.fill(0, s, s + w * 4);
      else if (f.disposal === 3 && backup) this.canvas.set(backup.subarray(r * w * 4, (r + 1) * w * 4), s);
    }
  }

  /** 前進一格並回傳目前畫布（同一個陣列，每次呼叫會被原地更新）。 */
  next(): { canvas: Uint8ClampedArray; delayMs: number; index: number; last: boolean } | null {
    if (this.done) return null;
    this.applyDispose();
    const f = this.gif.frames[this.idx]!;
    const backup = f.disposal === 3 ? this.region(f) : null;
    const { width, height } = this.gif;
    for (let r = 0; r < f.h; r++) {
      const y = f.y + r;
      if (y >= height) break;
      for (let c = 0; c < f.w; c++) {
        const x = f.x + c;
        if (x >= width) break;
        const si = (r * f.w + c) * 4;
        if (f.rgba[si + 3] === 0) continue; // 透明像素：保留底下原本的內容
        const di = (y * width + x) * 4;
        this.canvas[di] = f.rgba[si]!;
        this.canvas[di + 1] = f.rgba[si + 1]!;
        this.canvas[di + 2] = f.rgba[si + 2]!;
        this.canvas[di + 3] = 255;
      }
    }
    this.pendingDispose = f.disposal === 2 || f.disposal === 3 ? { frame: f, backup } : null;
    const index = this.idx++;
    return { canvas: this.canvas, delayMs: f.delayMs, index, last: this.idx >= this.gif.frames.length };
  }
}
