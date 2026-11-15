/**
 * .env 診斷核心（唯讀）。完全不輸出任何變數的「值」，只回報：有沒有、長度、格式問題、被哪個檔案覆蓋。
 * 模擬 Next.js 的載入順序（開發模式）：.env.development.local > .env.local > .env.development > .env
 */
import fs from "fs";
import path from "path";

export interface EnvIssue {
  level: "error" | "warn" | "info";
  message: string;
}

const DEV_ORDER = [".env.development.local", ".env.local", ".env.development", ".env"];

export function detectEncoding(buf: Buffer): "utf8" | "utf8-bom" | "utf16le" | "utf16be" {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return "utf16le";
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return "utf16be";
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return "utf8-bom";
  // 沒有 BOM 但大量 NUL（UTF-16 無 BOM）
  const sample = buf.subarray(0, Math.min(buf.length, 200));
  if (sample.length > 4 && [...sample].filter((b) => b === 0).length > sample.length / 4) return "utf16le";
  return "utf8";
}

/** 簡化版 dotenv 解析（足以判斷是否有值）。回傳 key → { raw, quoted }。 */
export function parseEnvText(text: string) {
  const out = new Map<string, { value: string; quoted: boolean; line: number }>();
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s*(?:export\s+)?([^=\s#][^=]*?)\s*=\s*(.*)$/);
    if (!m) return;
    const key = m[1]!;
    let v = m[2]!;
    let quoted = false;
    const q = v.match(/^(["'`])([\s\S]*?)\1/);
    if (q) {
      v = q[2]!;
      quoted = true;
    } else {
      v = v.replace(/\s+#.*$/, "").trim();
    }
    out.set(key, { value: v, quoted, line: i + 1 });
  });
  return out;
}

export function analyzeEnv(projectDir: string, names = ["NEXTAUTH_SECRET", "NEXTAUTH_URL"], processEnv: Record<string, string | undefined> = process.env): { issues: EnvIssue[]; effective: Record<string, number | null> } {
  const issues: EnvIssue[] = [];
  const add = (level: EnvIssue["level"], message: string) => issues.push({ level, message });
  const effective: Record<string, number | null> = {};

  if (!fs.existsSync(path.join(projectDir, "package.json"))) add("error", `${projectDir} 不是專案根目錄（找不到 package.json）。`);
  const present = DEV_ORDER.filter((f) => fs.existsSync(path.join(projectDir, f)));
  if (!present.includes(".env")) {
    const lookalikes = ["env", ".env.txt", "env.txt", ".env.example.txt"].filter((f) => fs.existsSync(path.join(projectDir, f)));
    add("error", `專案根目錄沒有 .env 檔案。${lookalikes.length ? "但找到長得像的檔案：" + lookalikes.join("、") + "（Windows 可能隱藏了副檔名 .txt，請改名成正確的 .env）。" : "請把 .env 複製到這個資料夾（新版 ZIP 不含 .env）。"}`);
  }

  const parsed: { file: string; vars: ReturnType<typeof parseEnvText> }[] = [];
  for (const f of present) {
    const buf = fs.readFileSync(path.join(projectDir, f));
    const enc = detectEncoding(buf);
    if (enc === "utf16le" || enc === "utf16be") {
      add("error", `${f} 是 UTF-16 編碼（常見於用 PowerShell 的 echo／Out-File 寫入）。Next.js 讀不到裡面任何變數。請用記事本「另存新檔 → 編碼選 UTF-8」，或用 VS Code 右下角「以編碼重新儲存 → UTF-8」。`);
      continue;
    }
    if (enc === "utf8-bom") add("warn", `${f} 開頭有 UTF-8 BOM：若第一行就是 NEXTAUTH_SECRET，變數名稱可能被讀成「\\uFEFFNEXTAUTH_SECRET」而找不到。請改存成「UTF-8（無 BOM）」，或在第一行放一行註解。`);
    const text = buf.toString(enc === "utf8-bom" ? "utf8" : "utf8").replace(/^﻿/, enc === "utf8-bom" ? "﻿" : "");
    parsed.push({ file: f, vars: parseEnvText(text) });
  }

  for (const name of names) {
    // 終端機／系統環境變數的優先權高於 .env：即使是「空字串」，Next.js 也不會再用 .env 的值補上。
    if (processEnv[name] === "") add("error", `${name} 在目前終端機／Windows 環境變數中被設成「空字串」，這會蓋掉 .env 的值（Next.js 不會覆蓋已存在的環境變數）。請在這個終端機執行 Remove-Item Env:${name}，並到「系統內容 → 環境變數」確認沒有同名的空變數，然後重新開啟終端機。`);
    else if (processEnv[name]) add("info", `${name} 已存在於目前終端機／系統環境變數（長度 ${processEnv[name]!.length}），會優先於 .env 檔案。`);
    // 名稱帶 BOM／空白／錯字的近似名稱
    for (const p of parsed) {
      for (const k of p.vars.keys()) {
        if (k !== name && k.replace(/[﻿\s]/g, "").toUpperCase() === name && k.replace(/[﻿]/g, "") !== name) add("error", `${p.file} 第 ${p.vars.get(k)!.line} 行的變數名稱 "${k.replace(/﻿/, "<BOM>")}" 和 ${name} 不完全相同（大小寫／空白）。`);
        else if (k === "﻿" + name) add("error", `${p.file} 的 ${name} 前面有隱藏的 BOM 字元，變數名稱因此不是 ${name}。請改存成 UTF-8（無 BOM）。`);
        else if (name === "NEXTAUTH_SECRET" && /^(NEXT_AUTH_SECRET|NEXTAUTH_SECERT|NEXTAUTH_SECREt|AUTH_SECRET|NEXTAUTH_KEY)$/i.test(k)) add("warn", `${p.file} 有 ${k}：NextAuth v4 只認 NEXTAUTH_SECRET。`);
      }
    }
    // 依 Next 優先順序找第一個「有定義」的檔案
    let winner: { file: string; value: string; quoted: boolean; line: number } | null = null;
    for (const p of parsed) {
      const v = p.vars.get(name);
      if (v) {
        winner = { file: p.file, ...v };
        break;
      }
    }
    if (!winner) {
      effective[name] = null;
      add(name === "NEXTAUTH_SECRET" ? "error" : "warn", `${name}：所有 .env 檔案中都沒有（可讀取的）定義。`);
      continue;
    }
    effective[name] = winner.value.length;
    // 低優先檔案被高優先檔案的空值覆蓋
    for (const p of parsed) {
      const v = p.vars.get(name);
      if (v && p.file !== winner.file && v.value.length > 0 && winner.value.length === 0) add("error", `${name} 在 ${p.file} 有值，但被優先權更高的 ${winner.file}（第 ${winner.line} 行）設成空值，實際生效的是空值。`);
    }
    if (winner.value.length === 0) add("error", `${name} 實際生效的定義（${winner.file} 第 ${winner.line} 行）是空的。`);
    else {
      add("info", `${name}：由 ${winner.file} 第 ${winner.line} 行提供，長度 ${winner.value.length}（值不顯示）。`);
      if (name === "NEXTAUTH_SECRET") {
        if (winner.value.length < 16) add("warn", `${name} 太短（${winner.value.length}）；建議至少 32 字元的隨機字串。`);
        if (/[^\x21-\x7e]/.test(winner.value)) add("warn", `${name} 含有空白或非英數符號字元（例如中文、全形、「←」、空格）。若是範例註解被一起貼進來，請只留下亂碼本身。`);
        if (/^["'].*["']$/.test(winner.value)) add("warn", `${name} 的值本身帶引號字元（可能重複加了引號）。`);
      }
    }
  }
  return { issues, effective };
}
