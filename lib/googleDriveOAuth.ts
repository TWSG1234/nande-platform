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

export class DriveError extends Error {
  code: DriveErrorCode;
  constructor(code: DriveErrorCode, detail?: string) {
    super(detail ? `${DRIVE_MESSAGES[code]}（${detail}）` : DRIVE_MESSAGES[code]);
    this.name = "DriveError";
    this.code = code;
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

/** 不論是否缺漏，都回傳目前讀到的值與缺少的環境變數名稱（不含任何值）。 */
export function readOAuthEnv(env: Env = process.env) {
  const baseUrl = (env.NEXTAUTH_URL || "").replace(/\/+$/, "");
  const cfg = {
    clientId: (env.GOOGLE_OAUTH_CLIENT_ID || "").trim(),
    clientSecret: (env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(),
    folderId: (env.GOOGLE_DRIVE_FOLDER_ID || "").trim(),
    redirectUri: (env.GOOGLE_OAUTH_REDIRECT_URI || (baseUrl ? baseUrl + CALLBACK_PATH : "")).trim(),
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

/** 只回傳可以安全寫進日誌的資訊。gaxios 的原始錯誤物件含 request config（可能有 token／secret），絕不直接 console.error 它。 */
export function describeError(e: unknown): string {
  if (e instanceof DriveError) return e.code;
  const g = e as GErr;
  const reason = typeof g?.response?.data?.error === "object" ? g.response.data.error.errors?.[0]?.reason : g?.response?.data?.error;
  return [(e as Error)?.name ?? "Error", httpStatusOf(e) ?? "", reason ?? "", isInvalidGrant(e) ? "invalid_grant" : ""].filter(Boolean).join(" ");
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
    throw new DriveError("DRIVE_UPLOAD_FAILED", describeError(e));
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
    if (!fileId && (s === 404 || s === 403)) throw new DriveError("DRIVE_FOLDER_INACCESSIBLE", `HTTP ${s}`);
    if (s === 401) {
      await deps.store.markRevoked("DRIVE_AUTH_REVOKED").catch(() => undefined);
      throw new DriveError("DRIVE_AUTH_REVOKED");
    }
    throw new DriveError("DRIVE_UPLOAD_FAILED", describeError(e));
  }
}

async function checkFolder(drive: any, folderId: string) {
  try {
    const f = await withRetry<any>(() =>
      drive.files.get({ fileId: folderId, fields: "id,name,mimeType,trashed,capabilities(canAddChildren)", supportsAllDrives: true })
    );
    const d = f.data;
    if (d.mimeType !== "application/vnd.google-apps.folder" || d.trashed || d.capabilities?.canAddChildren === false) {
      throw new DriveError("DRIVE_FOLDER_INACCESSIBLE", "不是可寫入的資料夾");
    }
    return { name: String(d.name ?? "") };
  } catch (e) {
    if (e instanceof DriveError) throw e;
    throw new DriveError("DRIVE_FOLDER_INACCESSIBLE", describeError(e));
  }
}

/** 管理員按「檢查連線」：換 Access Token + 確認資料夾可寫入，不建立任何檔案。 */
export async function testConnection(deps: DriveDeps) {
  const { cfg, drive } = await authorizedDrive(deps);
  return checkFolder(drive, cfg.folderId);
}

/** callback：用授權碼換 token，確認 scope／Refresh Token／資料夾權限後才加密保存。 */
export async function completeAuthorization(code: string, adminId: string | null, deps: DriveDeps) {
  const cfg = requireConfig(deps.env);
  const client = (deps.makeClient ?? createOAuthClient)(cfg);
  let tokens;
  try {
    tokens = (await client.getToken(code)).tokens;
  } catch (e) {
    throw new DriveError("DRIVE_EXCHANGE_FAILED", describeError(e));
  }
  if (!tokens.refresh_token) throw new DriveError("DRIVE_NO_REFRESH_TOKEN");
  const granted = String(tokens.scope || "");
  if (!granted.split(/\s+/).includes(DRIVE_SCOPE)) {
    await client.revokeToken(tokens.refresh_token).catch(() => undefined);
    throw new DriveError("DRIVE_SCOPE_MISSING");
  }
  client.setCredentials(tokens);
  const drive: any = (deps.makeDrive ?? ((c: OAuth2Client) => google.drive({ version: "v3", auth: c })))(client);
  let email = "";
  try {
    const me = await withRetry<any>(() => drive.about.get({ fields: "user(emailAddress)" }));
    email = String(me.data.user?.emailAddress ?? "");
    const folder = await checkFolder(drive, cfg.folderId);
    await deps.store.save({ refreshTokenEnc: encryptToken(tokens.refresh_token, cfg.encryptionKey), accountEmail: email, scope: granted, adminId });
    return { email, folderName: folder.name };
  } catch (e) {
    // 資料夾不可寫入／資料表不存在等：不保存，並把剛拿到的 token 作廢，避免留下沒用的授權
    await client.revokeToken(tokens.refresh_token).catch(() => undefined);
    throw e instanceof DriveError ? e : new DriveError("DRIVE_EXCHANGE_FAILED", describeError(e));
  }
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
