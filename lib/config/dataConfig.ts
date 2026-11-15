/**
 * 固定資料位置設定（資料庫 + 上傳檔案）——整個專案「唯一」決定資料放哪裡的地方。
 *
 * 純 Node 模組（不 import 任何 Next.js / Prisma / "@/" 路徑），所以網站、Prisma CLI 包裝、
 * 備份／診斷／匯入等所有工具都能共用同一份邏輯，不會各自猜路徑。
 *
 * 本機模式（預設，NANDE_DB_MODE 未設定或 = local）
 *   資料夾位置依序取自：
 *     1. 環境變數 NANDE_DATA_DIR
 *     2. 使用者家目錄的 .nande-platform.json（{"dataDir": "..."}），由 `npm run data:init` 寫入
 *   兩者都沒有 → 明確報錯，絕不猜測、絕不自動建立新資料庫。
 *   資料庫 = <資料夾>/dev.db ；上傳 = <資料夾>/uploads ；備份 = <資料夾>/backups
 *   此模式「忽略」.env 裡的 DATABASE_URL（舊版 .env 還留著 file:./dev.db 也不會被誤用）。
 *
 * 遠端模式（NANDE_DB_MODE=remote，未來正式上線用 PostgreSQL）
 *   直接使用 DATABASE_URL；不檢查本機檔案。
 *
 * 這個檔案不含任何個人電腦路徑；實際路徑只存在使用者自己的環境變數或家目錄設定檔。
 */
import fs from "fs";
import os from "os";
import path from "path";

export class DataConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataConfigError";
  }
}

export const CONFIG_FILE_NAME = ".nande-platform.json";
export const DB_FILE_NAME = "dev.db";

export type DbMode = "local" | "remote";

export interface LocalDataConfig {
  mode: "local";
  dataDir: string;
  dataDirSource: "env" | "config-file";
  dbFile: string;
  /** 給 Prisma 用的 SQLite 連線字串（絕對路徑，斜線統一為 /）。 */
  dbUrl: string;
  uploadsDir: string;
  backupsDir: string;
  warnings: string[];
}
export interface RemoteDataConfig {
  mode: "remote";
  dbUrl: string;
  /** 遠端模式下的上傳位置由 STORAGE_DRIVER 決定（見 lib/storage）；本機資料夾只是備用。 */
  uploadsDir: string | null;
  warnings: string[];
}
export type DataConfig = LocalDataConfig | RemoteDataConfig;

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  /** 程式資料夾（預設 process.cwd()）；資料夾不可放在裡面，否則換版就會遺失。 */
  projectDir?: string;
  /** data:init 專用：允許資料庫檔案還不存在。 */
  allowMissingDb?: boolean;
  /** data:init 專用：直接指定資料夾（不讀環境變數／設定檔）。 */
  dataDirOverride?: string;
}

export function configFilePath(home = os.homedir()) {
  return path.join(home, CONFIG_FILE_NAME);
}

/** SQLite 連線字串：絕對路徑、反斜線改斜線（Windows、中文、空白路徑都適用）。 */
export function sqliteUrlFromFile(file: string) {
  return "file:" + path.resolve(file).replace(/\\/g, "/");
}

function isInside(child: string, parent: string) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function setupHelp() {
  return [
    "請先做一次性設定（只需要做一次，之後換新版資料夾都不用再做）：",
    '  npm run data:init -- --dir "你的資料資料夾" --from-db "現有的 dev.db" --from-uploads "現有的 public\\uploads"',
    "或自行設定環境變數 NANDE_DATA_DIR 指向資料夾。詳見 docs/南得遇見你管理員操作說明.md「二之一」。",
  ].join("\n");
}

export function readConfigFile(home = os.homedir()): { dataDir?: string } | null {
  const file = configFilePath(home);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    throw new DataConfigError(`設定檔 ${file} 不是有效的 JSON，請修正或刪除後重新執行 npm run data:init。`);
  }
}

/** 連線字串的主機名稱（小寫，並去掉 Neon 的 -pooler，讓 pooler 與直連視為同一個資料庫）。無法解析回傳 null。 */
export function dbHostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
  } catch {
    return null;
  }
}

/**
 * Vercel 上的資料庫環境防護（只在 Vercel，也就是 VERCEL 有值時生效；本機行為完全不變）。
 * - 每個 Vercel 環境都必須明確宣告 NANDE_DB_TARGET=production 或 preview。
 * - Production（VERCEL_ENV=production）：NANDE_DB_TARGET 必須是 production；若有設 NANDE_PROD_DB_HOST，DATABASE_URL 的主機必須與它相同。
 * - 其他（Preview、Development、無法判斷）一律當成 Preview：NANDE_DB_TARGET 必須是 preview、必須設定 NANDE_PROD_DB_HOST，
 *   且 DATABASE_URL（以及若有設的 DIRECT_URL）的主機不能等於正式資料庫主機。
 * 傳回錯誤訊息（不含連線字串與密碼），沒問題傳回 null。
 */
export function checkRemoteEnvironment(env: NodeJS.ProcessEnv, url: string): string | null {
  if (!env.VERCEL) return null;
  const target = (env.NANDE_DB_TARGET || "").trim().toLowerCase();
  if (target !== "production" && target !== "preview") {
    return "Vercel 上必須設定 NANDE_DB_TARGET：Production 環境設成 production，Preview 環境設成 preview（避免 Preview 誤用正式資料庫）。";
  }
  const vercelEnv = (env.VERCEL_ENV || "").trim().toLowerCase();
  const host = dbHostOf(url);
  const prodHost = dbHostOf(env.NANDE_PROD_DB_HOST ? "postgresql://" + env.NANDE_PROD_DB_HOST.replace(/^[a-z]+:\/\//i, "") : "");
  if (!host) return "DATABASE_URL 格式不正確，無法判斷主機名稱。";
  if (vercelEnv === "production") {
    if (target !== "production") return "目前是 Vercel Production 環境，但 NANDE_DB_TARGET 不是 production。";
    if (env.NANDE_PROD_DB_HOST && host !== prodHost) return "Production 的 DATABASE_URL 主機與 NANDE_PROD_DB_HOST 不一致，已停止（請確認沒有貼錯資料庫）。";
    return null;
  }
  if (target !== "preview") return "目前不是 Vercel Production 環境，NANDE_DB_TARGET 卻設成 production：Preview 不可使用正式資料庫設定，已停止。";
  if (!prodHost) return "Preview 環境必須設定 NANDE_PROD_DB_HOST（正式資料庫的主機名稱，不含密碼），系統才能確認 Preview 沒有連到正式資料庫。";
  if (host === prodHost) return "Preview 環境的 DATABASE_URL 指向正式資料庫（主機與 NANDE_PROD_DB_HOST 相同），已停止。請在 Neon 建立獨立 Branch 並改用它的連線字串。";
  const directHost = dbHostOf(env.DIRECT_URL);
  if (directHost && directHost === prodHost) return "Preview 環境的 DIRECT_URL 指向正式資料庫，已停止。Preview 不應設定正式資料庫的任何連線字串。";
  return null;
}

export function resolveDataConfig(opt: ResolveOptions = {}): DataConfig {
  const env = opt.env ?? process.env;
  const warnings: string[] = [];
  const mode = (env.NANDE_DB_MODE || "local").toLowerCase();

  if (mode === "remote") {
    const url = env.DATABASE_URL;
    if (!url) throw new DataConfigError("NANDE_DB_MODE=remote 時必須設定 DATABASE_URL。");
    if (url.startsWith("file:")) throw new DataConfigError("NANDE_DB_MODE=remote 不可使用 SQLite（file:）連線字串。");
    const guard = checkRemoteEnvironment(env, url);
    if (guard) throw new DataConfigError(guard);
    return { mode: "remote", dbUrl: url, uploadsDir: env.NANDE_UPLOADS_DIR || null, warnings };
  }
  if (mode !== "local") throw new DataConfigError(`NANDE_DB_MODE 只能是 local 或 remote（目前是 "${env.NANDE_DB_MODE}"）。`);

  let dataDir = opt.dataDirOverride;
  let source: "env" | "config-file" = "env";
  if (!dataDir && env.NANDE_DATA_DIR) {
    dataDir = env.NANDE_DATA_DIR;
  } else if (!dataDir) {
    const cfg = readConfigFile(opt.home);
    if (cfg?.dataDir) {
      dataDir = cfg.dataDir;
      source = "config-file";
    }
  }
  if (!dataDir) throw new DataConfigError("找不到固定資料資料夾的設定（NANDE_DATA_DIR 或 " + configFilePath(opt.home) + "）。\n" + setupHelp());
  const dir: string = path.resolve(dataDir.trim().replace(/^["']|["']$/g, ""));

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new DataConfigError(`固定資料資料夾不存在或不是資料夾：${dir}\n為避免默默建立新的空資料庫，已停止。請確認路徑，或重新執行 npm run data:init。`);
  }
  const projectDir = opt.projectDir ?? process.cwd();
  if (isInside(dir, projectDir)) {
    throw new DataConfigError(`固定資料資料夾（${dir}）不可放在程式資料夾（${projectDir}）裡面，否則換新版資料夾時資料會被留下或遺失。`);
  }

  const dbFile = path.join(dir, DB_FILE_NAME);
  if (!opt.allowMissingDb) {
    if (!fs.existsSync(dbFile) || !fs.statSync(dbFile).isFile()) {
      throw new DataConfigError(`固定資料庫不存在：${dbFile}\n不會自動建立空白資料庫。請把正式的 dev.db 放進該資料夾（npm run data:init -- --from-db …），或修正 NANDE_DATA_DIR。`);
    }
    try {
      fs.accessSync(dbFile, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      throw new DataConfigError(`固定資料庫無法讀寫：${dbFile}（可能被其他程式鎖定或沒有權限）。`);
    }
  }

  const envUrl = env.DATABASE_URL;
  if (envUrl && envUrl.startsWith("file:")) {
    warnings.push(`偵測到 DATABASE_URL=${envUrl.replace(/\/[^/]*$/, "/…")}：本機模式會忽略它，一律使用 ${dbFile}。可以把 .env 裡的 DATABASE_URL 整行刪除。`);
  }

  return {
    mode: "local",
    dataDir: dir,
    dataDirSource: source,
    dbFile,
    dbUrl: sqliteUrlFromFile(dbFile),
    uploadsDir: path.resolve(env.NANDE_UPLOADS_DIR || path.join(dataDir, "uploads")),
    backupsDir: path.join(dataDir, "backups"),
    warnings,
  };
}

let cached: DataConfig | null = null;
/** 網站執行期使用（只解析一次）。設定錯誤會直接丟出 DataConfigError，不會被當成「沒資料」吞掉。 */
export function getDataConfig(): DataConfig {
  if (!cached) cached = resolveDataConfig();
  return cached;
}
export function __resetDataConfigCache() {
  cached = null;
}
