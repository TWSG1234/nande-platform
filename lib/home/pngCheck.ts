/**
 * 透明底 PNG 驗證（純 Node、不依賴任何圖片套件）。
 * 真的解析檔案：檢查簽章、區塊 CRC、IHDR、解壓縮像素資料、還原濾鏡，再逐像素確認「至少有一個透明像素」。
 * 不是只看副檔名或檔頭，所以「改了副檔名的 JPG／GIF」或「不透明的 PNG」都會被拒絕。
 */
import zlib from "zlib";

export const DECOR_LIMITS = {
  maxBytes: 2 * 1024 * 1024, // 2 MB
  maxSide: 4096, // 單邊最大像素
  maxPixels: 8_000_000, // 總像素上限（避免解壓縮吃光記憶體）
};

export class PngValidationError extends Error {}

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let crcTable: Uint32Array | null = null;
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type PngInfo = { width: number; height: number; colorType: number; bitDepth: number; transparentPixels: number };

export function validateTransparentPng(buf: Buffer): PngInfo {
  const fail = (m: string): never => {
    throw new PngValidationError(m);
  };
  if (buf.length > DECOR_LIMITS.maxBytes) fail(`檔案太大（${(buf.length / 1024 / 1024).toFixed(2)} MB），上限是 ${DECOR_LIMITS.maxBytes / 1024 / 1024} MB。請壓縮後再上傳。`);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIG)) fail("這不是有效的 PNG 檔案（可能是其他格式只改了副檔名）。裝飾圖樣只接受透明底 PNG。");

  let pos = 8;
  let ihdr: Buffer | null = null;
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  let sawIend = false;
  let first = true;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("latin1");
    if (len > buf.length || pos + 12 + len > buf.length) fail("PNG 檔案不完整或已損壞。");
    const data = buf.subarray(pos + 8, pos + 8 + len);
    const crc = buf.readUInt32BE(pos + 8 + len);
    if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== crc) fail("PNG 檔案已損壞（資料檢查碼不符）。");
    if (first && type !== "IHDR") fail("PNG 檔案結構不正確。");
    first = false;
    if (type === "IHDR") ihdr = data;
    else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") {
      sawIend = true;
      break;
    }
    pos += 12 + len;
  }
  if (!ihdr || ihdr.length !== 13 || !sawIend || !idat.length) fail("PNG 檔案不完整或已損壞。");
  const width = ihdr!.readUInt32BE(0);
  const height = ihdr!.readUInt32BE(4);
  const bitDepth = ihdr![8]!;
  const colorType = ihdr![9]!;
  const interlace = ihdr![12]!;
  if (!width || !height) fail("PNG 圖片尺寸不正確。");
  if (width > DECOR_LIMITS.maxSide || height > DECOR_LIMITS.maxSide) fail(`圖片尺寸太大（${width}×${height}），單邊上限 ${DECOR_LIMITS.maxSide} 像素。`);
  if (width * height > DECOR_LIMITS.maxPixels) fail(`圖片像素太多（${width}×${height}），總量上限約 ${DECOR_LIMITS.maxPixels / 1_000_000} 百萬像素。`);
  if (interlace !== 0) fail("不支援「交錯式（interlaced）」PNG，請在匯出時取消交錯後重新上傳。");
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  const okDepth: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!channels || !okDepth[colorType]!.includes(bitDepth)) fail("PNG 的色彩格式不正確。");
  if (colorType === 3 && !plte) fail("PNG 缺少色盤資料，檔案已損壞。");

  // 沒有任何形式的透明資訊 → 直接拒絕（不用解壓縮）
  const hasAlphaChannel = colorType === 4 || colorType === 6;
  if (!hasAlphaChannel && !trns) fail("這張 PNG 沒有透明通道（背景不透明）。裝飾圖樣必須是透明底 PNG，請匯出時保留透明背景。");

  const bitsPerPixel = (channels as number) * bitDepth;
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const expected = (rowBytes + 1) * height;
  let raw: Buffer;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: expected + 1024 });
  } catch {
    return fail("PNG 影像資料無法解碼，檔案可能已損壞。");
  }
  if (raw.length < expected) fail("PNG 影像資料不完整，檔案可能已損壞。");

  // 還原每列濾鏡
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const px = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (rowBytes + 1)]!;
    const src = y * (rowBytes + 1) + 1;
    const dst = y * rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[src + i]!;
      const a = i >= bpp ? px[dst + i - bpp]! : 0;
      const b = y > 0 ? px[dst - rowBytes + i]! : 0;
      const c = y > 0 && i >= bpp ? px[dst - rowBytes + i - bpp]! : 0;
      let v: number;
      switch (ft) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: return fail("PNG 影像資料格式不正確，檔案可能已損壞。");
      }
      px[dst + i] = v & 0xff;
    }
  }

  // 逐像素數透明像素（alpha < 255）
  let transparent = 0;
  const sample = (row: number, idx: number): number => {
    // 取第 idx 個「樣本」（不分通道）的值，支援 1/2/4/8/16 位元
    const base = row * rowBytes;
    if (bitDepth === 8) return px[base + idx]!;
    if (bitDepth === 16) return (px[base + idx * 2]! << 8) | px[base + idx * 2 + 1]!;
    const bitPos = idx * bitDepth;
    const byte = px[base + (bitPos >> 3)]!;
    return (byte >> (8 - bitDepth - (bitPos & 7))) & ((1 << bitDepth) - 1);
  };
  const full = bitDepth === 16 ? 65535 : 255;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let isT = false;
      if (colorType === 6) isT = sample(y, x * 4 + 3) < full;
      else if (colorType === 4) isT = sample(y, x * 2 + 1) < full;
      else if (colorType === 3) {
        const i = sample(y, x);
        isT = !!trns && i < trns.length && trns[i]! < 255;
      } else if (colorType === 0) {
        isT = !!trns && trns.length >= 2 && sample(y, x) === trns.readUInt16BE(0);
      } else if (colorType === 2) {
        isT = !!trns && trns.length >= 6 && sample(y, x * 3) === trns.readUInt16BE(0) && sample(y, x * 3 + 1) === trns.readUInt16BE(2) && sample(y, x * 3 + 2) === trns.readUInt16BE(4);
      }
      if (isT) transparent++;
    }
  }
  if (transparent === 0) fail("這張 PNG 雖然帶有透明通道，但圖片裡沒有任何透明的像素（整張都是不透明的）。裝飾圖樣必須有透明背景。");
  return { width, height, colorType, bitDepth, transparentPixels: transparent };
}
