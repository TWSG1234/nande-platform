import crypto from "crypto";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { DRIVE_MESSAGES, DriveErrorCode } from "@/lib/googleDriveMessages";

/**
 * Google Drive 個人 Gmail OAuth 2.0（Web Server Flow）核心。
 *
 * 為什麼是 scope=drive（而不是 drive.file）：
 *   drive.file 只能碰「這個應用程式自己建立」或「使用者用 Picker 明確選取」的檔案。
 *   原本的投稿資料夾是你手動建立的，應用程式沒辦法用 drive.file 寫進去（Google 會回 404）。
 *   要保留原資料夾，只能用 drive scope（Google 分類為「受限範圍」）。程式只會做兩件事：
 *   在該資料夾建立檔案、讀取該資料夾的中繼資料；不會列出、讀取或刪除你 Drive 的其他檔案。
 *
 * 本檔不含 import "@/lib/prisma"：資料庫存取由呼叫端注入（方便測試，也避免在建置時載入 DB）。
 */

type Env = Record<string, string | undefined>;
export type { Env as DriveEnv };

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const CALLBACK_PATH = "/api/admin/google-drive/callback";
export const STATE_COOKIE = "nande_gdrive_state";
export const STATE_COOKIE_PATH = "/api/admin/google-drive";
export const STATE_TTL_SECONDS = 600;

/** 可以安全寫進日誌的診斷資訊（已過濾機密）。 */
export interface DriveDiag {
  stage: string; // token-exchange | duplicate-code | account-check | folder-check | db-save | token-refresh | upload ...
  httpStatus?: number;
  googleError?: string; // Google 回傳的 error（例如 invalid_client）
  description?: string; // 已過濾的 error_description
  errName?: string;
  netCode?: string; // 網路層錯誤碼（ENOTFOUND、ETIMEDOUT…）
}

export class DriveError extends Error {
  code: DriveErrorCode;
  diag?: DriveDiag;
  constructor(code: DriveErrorCode, detail?: string, diag?: DriveDiag) {
    super(detail ? `${DRIVE_MESSAGES[code]}（${detail}）` : DRIVE_MESSAGES[code]);
    this.name = "DriveError";
    this.code = code;
    this.diag = diag;
  }
}

// ── 設定 ────────────────────────────────────────────────────────────────

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  folderId: string;
  redirectUri: string;
  encryptionKey: string;
  stateSecret: string;
}

export type DriveMode = "off" | "misconfigured" | "on";

/**
 * 去掉前後空白／換行，以及整個值外層多貼的一對引號（在 Vercel 後台貼成 "xxx" 是常見的錯誤，
 * 會讓 Google 回 invalid_client）。刻意「不」用在加密金鑰與 NEXTAUTH_SECRET：那兩個值一改就會變成另一把金鑰。
 */
export function cleanEnv(v: string | undefined): string {
  let x = (v ?? "").trim();
  if (x.length >= 2 && ((x[0] === '"' && x.endsWith('"')) || (x[0] === "'" && x.endsWith("'")))) x = x.slice(1, -1).trim();
  return x;
}

/** 不論是否缺漏，都回傳目前讀到的值與缺少的環境變數名稱（不含任何值）。 */
export function readOAuthEnv(env: Env = process.env) {
  const baseUrl = cleanEnv(env.NEXTAUTH_URL).replace(/\/+$/, "");
  const cfg = {
    clientId: cleanEnv(env.GOOGLE_OAUTH_CLIENT_ID),
    clientSecret: cleanEnv(env.GOOGLE_OAUTH_CLIENT_SECRET),
    folderId: cleanEnv(env.GOOGLE_DRIVE_FOLDER_ID),
    redirectUri: cleanEnv(env.GOOGLE_OAUTH_REDIRECT_URI) || (baseUrl ? baseUrl + CALLBACK_PATH : ""),
    encryptionKey: env.GOOGLE_TOKEN_ENCRYPTION_KEY || "",
    stateSecret: env.NEXTAUTH_SECRET || "",
  };
  const missing: string[] = [];
  if (!cfg.clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!cfg.clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!cfg.folderId) missing.push("GOOGLE_DRIVE_FOLDER_ID");
  if (!cfg.redirectUri) missing.push("GOOGLE_OAUTH_REDIRECT_URI（或 NEXTAUTH_URL）");
  if (cfg.encryptionKey.length < 16) missing.push("GOOGLE_TOKEN_ENCRYPTION_KEY（至少 16 字元）");
  if (!cfg.stateSecret) missing.push("NEXTAUTH_SECRET");
  return { cfg, missing };
}

/**
 * off          — 完全沒設定 OAuth（沒有 Client ID／Secret）→ 沿用舊行為：通過的照片留在網站儲存層，不上傳 Drive。
 * misconfigured— 設了一部分但不齊全 → 審核「通過」會回明確錯誤，不會悄悄略過 Drive。
 * on           — 設定齊全。
 */
export function driveMode(env: Env = process.env): DriveMode {
  const { cfg, missing } = readOAuthEnv(env);
  if (!cfg.clientId && !cfg.clientSecret) return "off";
  return missing.length ? "misconfigured" : "on";
}

export function requireConfig(env: Env = process.env): OAuthConfig {
  const { cfg, missing } = readOAuthEnv(env);
  if (missing.length) throw new DriveError("DRIVE_NOT_CONFIGURED", "缺少：" + missing.join("、"));
  return cfg;
}

export function createOAuthClient(cfg: OAuthConfig): OAuth2Client {
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

// ── Refresh Token 加密（AES-256-GCM）──────────────────────────────────────

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "nande-gdrive-token-v1", 32);
}

export function encryptToken(plain: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptToken(blob: string, secret: string): string {
  const [v, iv, tag, ct] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("token-format");
  const d = crypto.createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

// ── OAuth state（防 CSRF）──────────────────────────────────────────────────
// state = nonce.HMAC(nonce + 管理員 id)。nonce 同時放在 httpOnly cookie；callback 必須「cookie 的 nonce
// 與 state 一致」且「簽章是同一位管理員簽的」才通過，所以別人無法拿自己的授權碼塞給你的瀏覽器。

function hmac(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}
function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createState(adminId: string, secret: string) {
  const nonce = crypto.randomBytes(24).toString("base64url");
  return { nonce, state: `${nonce}.${hmac(secret, `${nonce}.${adminId}`)}` };
}

export function verifyState(p: { state: string | null; cookieNonce: string | null; adminId: string; secret: string }): boolean {
  if (!p.state || !p.cookieNonce || !p.adminId || !p.secret) return false;
  const i = p.state.indexOf(".");
  if (i < 1) return false;
  const nonce = p.state.slice(0, i), sig = p.state.slice(i + 1);
  if (!safeEq(nonce, p.cookieNonce)) return false;
  return safeEq(sig, hmac(p.secret, `${nonce}.${p.adminId}`));
}

// ── 授權網址 ───────────────────────────────────────────────────────────────

export function buildAuthUrl(client: OAuth2Client, state: string): string {
  return client.generateAuthUrl({
    access_type: "offline", // 要 Refresh Token
    prompt: "consent", // 每次都重新取得同意，才保證回傳 Refresh Token
    scope: [DRIVE_SCOPE],
    state,
  });
}

// ── 儲存（由呼叫端注入，正式環境是 Prisma）────────────────────────────────

export interface AuthRow {
  refreshTokenEnc: string;
  accountEmail: string;
  scope: string;
  status: string;
  lastError: string | null;
  connectedAt: Date;
}
export interface DriveAuthStore {
  get(): Promise<AuthRow | null>;
  save(row: { refreshTokenEnc: string; accountEmail: string; scope: string; adminId: string | null }): Promise<void>;
  markRevoked(code: string): Promise<void>;
  clear(): Promise<void>;
}

type PrismaLike = { googleDriveAuth: any };

function wrapDb<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((e) => {
    // P2021 = 資料表不存在（Neon／本機還沒建立新資料表）
    if ((e as { code?: string })?.code === "P2021" || /GoogleDriveAuth.*(does not exist|no such table)|no such table.*GoogleDriveAuth/i.test(String((e as Error)?.message))) {
      throw new DriveError("DRIVE_TABLE_MISSING");
    }
    throw e;
  });
}

export function prismaDriveAuthStore(prisma: PrismaLike): DriveAuthStore {
  const t = () => prisma.googleDriveAuth;
  return {
    get: () => wrapDb(() => t().findUnique({ where: { id: "default" } })),
    save: (r) =>
      wrapDb(() =>
        t().upsert({
          where: { id: "default" },
          create: { id: "default", refreshTokenEnc: r.refreshTokenEnc, accountEmail: r.accountEmail, scope: r.scope, status: "active", lastError: null, connectedByAdminId: r.adminId },
          update: { refreshTokenEnc: r.refreshTokenEnc, accountEmail: r.accountEmail, scope: r.scope, status: "active", lastError: null, connectedByAdminId: r.adminId, connectedAt: new Date() },
        })
      ).then(() => undefined),
    markRevoked: (code) =>
      wrapDb(() => t().updateMany({ where: { id: "default" }, data: { status: "revoked", lastError: code } })).then(() => undefined),
    clear: () => wrapDb(() => t().deleteMany({ where: { id: "default" } })).then(() => undefined),
  };
}

// ── 錯誤處理 ───────────────────────────────────────────────────────────────

interface GErr { code?: number | string; status?: number; message?: string; response?: { status?: number; data?: { error?: string | { message?: string; errors?: { reason?: string }[] }; error_description?: string } } }

export function httpStatusOf(e: unknown): number | undefined {
  const g = e as GErr;
  const s = g?.response?.status ?? g?.status ?? (typeof g?.code === "number" ? g.code : undefined);
  return typeof s === "number" ? s : undefined;
}

export function isInvalidGrant(e: unknown): boolean {
  const g = e as GErr;
  const d = g?.response?.data;
  return d?.error === "invalid_grant" || /invalid_grant/.test(String(g?.message ?? ""));
}

const MIN_SECRET_LEN = 6;

/** 目前環境中已知的機密值，過濾文字時一律先遮蔽（呼叫端不必每次傳）。 */
function envSecrets(): string[] {
  const { cfg } = readOAuthEnv();
  return [cfg.clientSecret, cfg.encryptionKey, cfg.stateSecret, process.env.GOOGLE_OAUTH_CLIENT_SECRET, process.env.GOOGLE_TOKEN_ENCRYPTION_KEY].filter((x): x is string => Boolean(x));
}

/** 過濾可能出現在錯誤文字裡的機密：已知的機密值、常見 token 格式、Authorization、email，並限制長度。 */
export function sanitizeText(text: unknown, secrets: (string | undefined | null)[] = [], max = 200): string {
  let t = String(text ?? "").replace(/\s+/g, " ").trim();
  for (const sec of [...secrets, ...envSecrets()]) {
    if (sec && sec.length >= MIN_SECRET_LEN) t = t.split(sec).join("[REDACTED]");
    // 同一個值被 URL 編碼後出現時也要擋
    if (sec && sec.length >= MIN_SECRET_LEN) t = t.split(encodeURIComponent(sec)).join("[REDACTED]");
  }
  t = t
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/((?:set-)?cookie\s*[:=]\s*)[^;\n]+/gi, "$1[REDACTED]")
    .replace(/ya29\.[\w.-]+/g, "[REDACTED]")
    .replace(/1\/\/[\w.-]+/g, "[REDACTED]")
    .replace(/GOCSPX-[\w-]+/g, "[REDACTED]")
    .replace(/\b4\/[\w-]{20,}/g, "[REDACTED]")
    .replace(/((?:code|client_secret|refresh_token|access_token|id_token|token|secret|password)=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/[A-Za-z0-9_\-.~+/=]{40,}/g, "[REDACTED]");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

/** 從 Google／gaxios 錯誤取出可記錄的欄位（status、error、過濾後的 error_description）。 */
export function diagnose(e: unknown, stage: string, secrets: (string | undefined | null)[] = []): DriveDiag {
  if (e instanceof DriveError && e.diag) return e.diag;
  const g = e as GErr & { code?: string | number };
  const data = g?.response?.data as { error?: unknown; error_description?: unknown } | undefined;
  let googleError: string | undefined;
  let description: string | undefined;
  if (typeof data?.error === "string") googleError = data.error;
  else if (data?.error && typeof data.error === "object") {
    const o = data.error as { status?: string; message?: string; errors?: { reason?: string }[] };
    googleError = o.errors?.[0]?.reason || o.status;
    description = o.message;
  }
  if (typeof data?.error_description === "string") description = data.error_description;
  if (!description && !g?.response) description = (e as Error)?.message; // 沒有 HTTP 回應（網路層）才用 message
  return {
    stage,
    httpStatus: httpStatusOf(e),
    googleError: googleError ? sanitizeText(googleError, secrets, 60) : undefined,
    description: description ? sanitizeText(description, secrets) : undefined,
    errName: (e as Error)?.name,
    netCode: typeof g?.code === "string" ? sanitizeText(g.code, secrets, 30) : undefined,
  };
}

/** 給管理員／維護者的下一步提示（只放在日誌，不含機密）。 */
export function hintFor(d: DriveDiag): string {
  const ge = d.googleError ?? "";
  if (ge === "invalid_client") return "Client ID／Client Secret 不正確或不是同一組：檢查 Vercel 的 GOOGLE_OAUTH_CLIENT_SECRET 是否完整、沒有多餘引號或空白、與 Client ID 屬於同一個 OAuth 用戶端，修改後要 Redeploy";
  if (ge === "redirect_uri_mismatch") return "redirect_uri 與 Google Cloud 登記的不一致：日誌中的 redirectUri 必須逐字出現在『已授權的重新導向 URI』";
  if (ge === "invalid_grant") return "授權碼已使用、過期，或換碼時的 redirect_uri 與授權時不同；請重新從授權頁開始一次";
  if (ge === "unauthorized_client") return "此用戶端不允許這種授權方式，確認建立的是『網頁應用程式』類型";
  if (ge === "invalid_request") return "請求缺少或帶了錯誤參數（常見：redirect_uri 或 client 設定缺漏）";
  if (ge === "access_denied") return "Google 帳號未被允許（測試模式下需在 Audience 加入測試使用者）";
  if (d.netCode && /ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN/.test(d.netCode)) return "連到 Google 的網路層失敗，通常是暫時性，可稍後重試";
  if (d.stage === "duplicate-code") return "同一個授權碼被送出兩次，只有第一次會成功";
  if (d.stage === "db-save") return "授權碼已換成功，但寫入資料庫失敗：檢查 GoogleDriveAuth 資料表與資料庫連線";
  if (d.stage === "account-check" || d.stage === "folder-check") return "授權成功，但驗證帳號或資料夾失敗：檢查 Drive API 是否啟用、資料夾 ID 與該 Gmail 的權限";
  return "";
}

/** 可以安全寫進日誌的單行描述（含 stage／HTTP status／Google error／過濾後的說明）。 */
export function describeError(e: unknown): string {
  if (e instanceof DriveError) {
    const d = e.diag;
    return [e.code, d ? `stage=${d.stage}` : "", d?.httpStatus ? `status=${d.httpStatus}` : "", d?.googleError ? `google_error=${d.googleError}` : "", d?.netCode ? `net=${d.netCode}` : "", d?.description ? `desc="${d.description}"` : "", d ? (hintFor(d) ? `hint="${hintFor(d)}"` : "") : ""].filter(Boolean).join(" ");
  }
  const g = e as GErr;
  const d = diagnose(e, "unknown");
  return [(e as Error)?.name ?? "Error", d.httpStatus ?? "", d.googleError ?? "", isInvalidGrant(e) ? "invalid_grant" : "", d.description ? `desc="${d.description}"` : ""].filter(Boolean).join(" ") || String(g?.message ? "error" : "unknown");
}

// 同一個授權碼只能換一次：同一個伺服器實例內擋掉重複送出（跨實例時由 Google 回 invalid_grant）
const usedCodes = new Map<string, number>();
function claimCode(code: string): boolean {
  const now = Date.now();
  for (const [k, t] of usedCodes) if (now - t > 10 * 60_000) usedCodes.delete(k);
  const h = crypto.createHash("sha256").update(code).digest("hex");
  if (usedCodes.has(h)) return false;
  usedCodes.set(h, now);
  return true;
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const s = httpStatusOf(e);
      const transient = s === 429 || (s !== undefined && s >= 500) || (s === undefined && !isInvalidGrant(e) && /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(String((e as Error)?.message)));
      if (!transient || i === tries - 1) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last;
}

// ── Drive 用戶端（Refresh Token → Access Token 由 googleapis 自動換新）─────

export interface DriveDeps {
  store: DriveAuthStore;
  env?: Env;
  /** 測試用：替換 Google 用戶端。 */
  makeClient?: (cfg: OAuthConfig) => OAuth2Client;
  makeDrive?: (client: OAuth2Client) => any;
}

async function authorizedDrive(deps: DriveDeps) {
  const cfg = requireConfig(deps.env);
  const row = await deps.store.get();
  if (!row) throw new DriveError("DRIVE_NOT_AUTHORIZED");
  if (row.status !== "active") throw new DriveError("DRIVE_AUTH_REVOKED");
  let refresh: string;
  try {
    refresh = decryptToken(row.refreshTokenEnc, cfg.encryptionKey);
  } catch {
    // 加密金鑰換過或資料毀損：無法使用，需要重新授權（不要把細節丟給前端）
    throw new DriveError("DRIVE_AUTH_REVOKED", "已儲存的憑證無法解密，請重新授權");
  }
  const client = (deps.makeClient ?? createOAuthClient)(cfg);
  client.setCredentials({ refresh_token: refresh });
  try {
    await client.getAccessToken(); // 立刻換新 Access Token；過期／撤銷會在這裡就發現
  } catch (e) {
    if (isInvalidGrant(e)) {
      await deps.store.markRevoked("DRIVE_AUTH_REVOKED").catch(() => undefined);
      throw new DriveError("DRIVE_AUTH_REVOKED");
    }
    throw new DriveError("DRIVE_UPLOAD_FAILED", undefined, diagnose(e, "token-refresh", [cfg.clientSecret, cfg.encryptionKey, refresh]));
  }
  const drive: any = (deps.makeDrive ?? ((c: OAuth2Client) => google.drive({ version: "v3", auth: c })))(client);
  return { cfg, drive, client };
}

/** 與舊版相同的簽名與回傳值，審核通過時呼叫。 */
export async function uploadBufferViaOAuth(
  params: { buffer: Buffer; filename: string; mimeType: string },
  deps: DriveDeps
): Promise<{ fileId: string; viewUrl: string }> {
  const { Readable } = await import("stream");
  const { cfg, drive } = await authorizedDrive(deps);
  let fileId: string | undefined;
  try {
    const res = await withRetry<any>(() =>
      drive.files.create({
        requestBody: { name: params.filename, parents: [cfg.folderId] },
        media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
        fields: "id",
        supportsAllDrives: true,
      })
    );
    fileId = res.data.id as string | undefined;
    if (!fileId) throw new DriveError("DRIVE_UPLOAD_FAILED", "Google 沒有回傳檔案 ID");
    // 讓連結可直接檢視（與舊版相同）；失敗就把剛建立的檔案移除，避免留下無法顯示的孤兒檔
    await withRetry(() => drive.permissions.create({ fileId: fileId as string, requestBody: { role: "reader", type: "anyone" }, supportsAllDrives: true }));
    return { fileId, viewUrl: `https://drive.google.com/uc?id=${fileId}` };
  } catch (e) {
    if (e instanceof DriveError) throw e;
    if (fileId) await Promise.resolve(drive.files.delete({ fileId, supportsAllDrives: true })).catch(() => undefined);
    if (isInvalidGrant(e)) {
      await deps.store.markRevoked("DRIVE_AUTH_REVOKED").catch(() => undefined);
      throw new DriveError("DRIVE_AUTH_REVOKED");
    }
    const s = httpStatusOf(e);
    if (!fileId && (s === 404 || s === 403)) throw new DriveError("DRIVE_FOLDER_INACCESSIBLE", undefined, diagnose(e, "upload", [cfg.clientSecret, cfg.encryptionKey]));
    if (s === 401) {
      await deps.store.markRevoked("DRIVE_AUTH_REVOKED").catch(() => undefined);
      throw new DriveError("DRIVE_AUTH_REVOKED");
    }
    throw new DriveError("DRIVE_UPLOAD_FAILED", undefined, diagnose(e, "upload", [cfg.clientSecret, cfg.encryptionKey]));
  }
}

async function checkFolder(drive: any, folderId: string) {
  try {
    const f = await withRetry<any>(() =>
      drive.files.get({ fileId: folderId, fields: "id,name,mimeType,trashed,capabilities(canAddChildren)", supportsAllDrives: true })
    );
    const d = f.data;
    if (d.mimeType !== "application/vnd.google-apps.folder" || d.trashed || d.capabilities?.canAddChildren === false) {
      throw new DriveError("DRIVE_FOLDER_INACCESSIBLE", "不是可寫入的資料夾", { stage: "folder-check" });
    }
    return { name: String(d.name ?? "") };
  } catch (e) {
    if (e instanceof DriveError) throw e;
    throw new DriveError("DRIVE_FOLDER_INACCESSIBLE", undefined, diagnose(e, "folder-check"));
  }
}

/** 管理員按「檢查連線」：換 Access Token + 確認資料夾可寫入，不建立任何檔案。 */
export async function testConnection(deps: DriveDeps) {
  const { cfg, drive } = await authorizedDrive(deps);
  return checkFolder(drive, cfg.folderId);
}

/** callback：用授權碼換 token，確認 scope／Refresh Token／資料夾權限後才加密保存。每個階段的失敗都帶 stage 與過濾後的 Google 錯誤。 */
export async function completeAuthorization(code: string, adminId: string | null, deps: DriveDeps) {
  const cfg = requireConfig(deps.env);
  const secrets: string[] = [cfg.clientSecret, cfg.encryptionKey, cfg.stateSecret, code];
  const client = (deps.makeClient ?? createOAuthClient)(cfg);

  if (!claimCode(code)) throw new DriveError("DRIVE_EXCHANGE_FAILED", undefined, { stage: "duplicate-code" });

  let tokens;
  try {
    tokens = (await client.getToken(code)).tokens;
  } catch (e) {
    throw new DriveError("DRIVE_EXCHANGE_FAILED", undefined, diagnose(e, "token-exchange", secrets));
  }
  const toRevoke = tokens.refresh_token ?? tokens.access_token ?? undefined;
  if (toRevoke) secrets.push(toRevoke);
  if (tokens.access_token) secrets.push(tokens.access_token);
  if (!tokens.refresh_token) throw new DriveError("DRIVE_NO_REFRESH_TOKEN", undefined, { stage: "token-exchange" });
  const granted = String(tokens.scope || "");
  if (!granted.split(/\s+/).includes(DRIVE_SCOPE)) {
    await client.revokeToken(tokens.refresh_token).catch(() => undefined);
    throw new DriveError("DRIVE_SCOPE_MISSING", undefined, { stage: "token-exchange" });
  }
  client.setCredentials(tokens);
  const drive: any = (deps.makeDrive ?? ((c: OAuth2Client) => google.drive({ version: "v3", auth: c })))(client);
  const abort = async (err: DriveError) => {
    await client.revokeToken(tokens.refresh_token as string).catch(() => undefined); // 不保存就把剛拿到的授權作廢
    throw err;
  };

  let email = "";
  try {
    const me = await withRetry<any>(() => drive.about.get({ fields: "user(emailAddress)" }));
    email = String(me.data.user?.emailAddress ?? "");
  } catch (e) {
    return abort(new DriveError("DRIVE_VERIFY_FAILED", undefined, diagnose(e, "account-check", secrets)));
  }
  let folderName = "";
  try {
    folderName = (await checkFolder(drive, cfg.folderId)).name;
  } catch (e) {
    if (e instanceof DriveError) return abort(new DriveError(e.code, undefined, { ...(e.diag ?? { stage: "folder-check" }), stage: "folder-check" }));
    return abort(new DriveError("DRIVE_VERIFY_FAILED", undefined, diagnose(e, "folder-check", secrets)));
  }
  try {
    await deps.store.save({ refreshTokenEnc: encryptToken(tokens.refresh_token, cfg.encryptionKey), accountEmail: email, scope: granted, adminId });
  } catch (e) {
    if (e instanceof DriveError) return abort(new DriveError(e.code, undefined, { stage: "db-save" }));
    return abort(new DriveError("DRIVE_STORE_FAILED", undefined, { ...diagnose(e, "db-save", secrets), description: undefined })); // 資料庫錯誤文字可能含連線資訊，只留 errName／code
  }
  return { email, folderName };
}

export async function disconnect(deps: DriveDeps) {
  const cfg = requireConfig(deps.env);
  const row = await deps.store.get();
  if (row) {
    try {
      const client = (deps.makeClient ?? createOAuthClient)(cfg);
      await client.revokeToken(decryptToken(row.refreshTokenEnc, cfg.encryptionKey));
    } catch {
      /* Google 端已撤銷或無法解密：仍然清掉本地紀錄 */
    }
  }
  await deps.store.clear();
}

export async function statusSummary(deps: DriveDeps) {
  const mode = driveMode(deps.env);
  const { cfg, missing } = readOAuthEnv(deps.env);
  let row: AuthRow | null = null;
  let tableMissing = false;
  if (mode !== "off") {
    try {
      row = await deps.store.get();
    } catch (e) {
      if (e instanceof DriveError && e.code === "DRIVE_TABLE_MISSING") tableMissing = true;
      else throw e;
    }
  }
  return {
    mode,
    missing,
    tableMissing,
    redirectUri: cfg.redirectUri || null,
    folderIdTail: cfg.folderId ? "…" + cfg.folderId.slice(-6) : null,
    authorized: Boolean(row && row.status === "active"),
    status: row?.status ?? null,
    accountEmail: row?.accountEmail ?? null,
    connectedAt: row?.connectedAt ?? null,
    lastError: row?.lastError ?? null,
  };
}
