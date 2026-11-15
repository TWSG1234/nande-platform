/**
 * 一次性初始化的核心邏輯（可獨立測試）：建立固定資料資料夾、放入正式資料庫與既有上傳圖片。
 * 原則：來源檔案只讀不改；目的地已存在的檔案一律不覆蓋；不建立空白資料庫。
 */
import fs from "fs";
import path from "path";
import { DB_FILE_NAME } from "../../lib/config/dataConfig";

export interface InitOptions {
  dataDir: string;
  fromDb?: string;
  fromUploads?: string[];
  /** 內建預設圖片（prisma/assets/uploads），只補缺。 */
  bundledUploads?: string;
}
export interface InitResult {
  lines: string[];
  ok: boolean;
  dbCopied: boolean;
  uploadsCopied: number;
  uploadsSkipped: number;
}

function copyTree(from: string, to: string, onCopy: () => void, onSkip: () => void) {
  if (!fs.existsSync(from)) return;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const src = path.join(from, e.name);
    const dst = path.join(to, e.name);
    if (e.isDirectory()) copyTree(src, dst, onCopy, onSkip);
    else if (e.isFile()) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      if (fs.existsSync(dst)) onSkip();
      else {
        fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL);
        onCopy();
      }
    }
  }
}

export function initDataDir(opt: InitOptions): InitResult {
  const lines: string[] = [];
  const res: InitResult = { lines, ok: true, dbCopied: false, uploadsCopied: 0, uploadsSkipped: 0 };
  const dir = path.resolve(opt.dataDir);
  fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(dir, "backups"), { recursive: true });
  lines.push(`資料資料夾：${dir}`);

  const dbTarget = path.join(dir, DB_FILE_NAME);
  if (fs.existsSync(dbTarget)) {
    lines.push(`✓ 已有資料庫：${dbTarget}（保持不動，沒有覆蓋）`);
  } else if (opt.fromDb) {
    const src = path.resolve(opt.fromDb);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      lines.push(`❌ 找不到來源資料庫：${src}`);
      res.ok = false;
    } else if (["-wal", "-shm", "-journal"].some((s) => fs.existsSync(src + s))) {
      lines.push(`❌ 來源資料庫旁有 ${path.basename(src)}-wal/-shm/-journal，代表網站可能還在執行。請先關閉網站（Ctrl+C）再試，以免複製到不完整的資料。`);
      res.ok = false;
    } else {
      fs.copyFileSync(src, dbTarget, fs.constants.COPYFILE_EXCL);
      if (fs.statSync(dbTarget).size !== fs.statSync(src).size) {
        lines.push("❌ 複製後檔案大小不一致，請重試。");
        res.ok = false;
      } else {
        res.dbCopied = true;
        lines.push(`✅ 已複製資料庫（${(fs.statSync(dbTarget).size / 1024).toFixed(1)} KB）：${src} → ${dbTarget}（來源檔案原封不動）`);
      }
    }
  } else {
    lines.push(`❌ 固定資料夾裡還沒有 ${DB_FILE_NAME}，也沒有指定 --from-db。不會建立空白資料庫。請用 --from-db 指定現有的 dev.db。`);
    res.ok = false;
  }

  const up = path.join(dir, "uploads");
  for (const src of opt.fromUploads ?? []) {
    let c = 0;
    let s = 0;
    if (!fs.existsSync(src)) {
      lines.push(`⚠ 找不到上傳來源資料夾，略過：${src}`);
      continue;
    }
    copyTree(path.resolve(src), up, () => c++, () => s++);
    res.uploadsCopied += c;
    res.uploadsSkipped += s;
    lines.push(`上傳圖片：從 ${src} 複製 ${c} 個，已存在而略過 ${s} 個（不覆蓋）`);
  }
  if (opt.bundledUploads) {
    let c = 0;
    copyTree(opt.bundledUploads, up, () => c++, () => {});
    res.uploadsCopied += c;
    lines.push(`內建預設圖片：補上缺少的 ${c} 個（已存在的不動）`);
  }
  return res;
}
