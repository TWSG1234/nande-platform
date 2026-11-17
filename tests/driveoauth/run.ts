/** Google Drive 個人 Gmail OAuth 測試：全部使用假的 Google 用戶端與記憶體儲存，不連網、不碰資料庫。 */
import assert from "assert";
import http from "http";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import type { AddressInfo } from "net";
import { OAuth2Client } from "google-auth-library";
import {
  buildAuthUrl, bufferToStream, cleanEnv, completeAuthorization, diagnose, hintFor, sanitizeText, OAuthConfig, createOAuthClient, createState, decryptToken, describeError, disconnect, DriveAuthStore, DriveError,
  driveMode, DRIVE_SCOPE, encryptToken, prismaDriveAuthStore, readOAuthEnv, statusSummary, testConnection, uploadBufferViaOAuth, verifyState, AuthRow,
} from "../../lib/googleDriveOAuth";

const SECRET = "test-nextauth-" + process.pid;
const ENV: Env = {
  GOOGLE_OAUTH_CLIENT_ID: "cid.apps.test", GOOGLE_OAUTH_CLIENT_SECRET: "csecret-" + process.pid, GOOGLE_DRIVE_FOLDER_ID: "folder123456",
  GOOGLE_TOKEN_ENCRYPTION_KEY: "enc-key-" + "k".repeat(30), NEXTAUTH_URL: "https://nande-platform.vercel.app/", NEXTAUTH_SECRET: SECRET,
};
type Env = Record<string, string | undefined>;
let pass = 0, fail = 0, codeN = 0;
const uc = () => `unique-auth-code-${++codeN}-${"u".repeat(12)}`;
async function t(name: string, fn: () => unknown | Promise<unknown>) {
  try { await fn(); pass++; console.log("  ✅ " + name); } catch (e) { fail++; console.log("  ❌ " + name + "\n     " + (e as Error).message); }
}
function memStore(init: AuthRow | null = null) {
  let row = init; const log: string[] = [];
  const store: DriveAuthStore = {
    get: async () => row,
    save: async (r) => { row = { refreshTokenEnc: r.refreshTokenEnc, accountEmail: r.accountEmail, scope: r.scope, status: "active", lastError: null, connectedAt: new Date() }; log.push("save"); },
    markRevoked: async (c) => { if (row) row = { ...row, status: "revoked", lastError: c }; log.push("revoked"); },
    clear: async () => { row = null; log.push("clear"); },
  };
  return { store, log, get: () => row };
}
const gErr = (status: number, error?: string) => Object.assign(new Error("boom"), { response: { status, data: { error } } });
function fakeClient(o: { tokens?: any; getTokenErr?: unknown; accessErr?: unknown } = {}) {
  const calls = { revoked: [] as string[], creds: null as any };
  const c = {
    setCredentials: (x: any) => { calls.creds = x; },
    getToken: async () => { if (o.getTokenErr) throw o.getTokenErr; return { tokens: o.tokens }; },
    getAccessToken: async () => { if (o.accessErr) throw o.accessErr; return { token: "at" }; },
    revokeToken: async (tok: string) => { calls.revoked.push(tok); },
  } as unknown as OAuth2Client;
  return { c, calls };
}
function fakeDrive(o: { createErr?: unknown; permErr?: unknown; getData?: any; getErr?: unknown } = {}) {
  const calls = { created: [] as any[], deleted: [] as string[], perms: [] as any[] };
  const d = {
    files: {
      create: async (a: any) => { calls.created.push(a); if (o.createErr) throw o.createErr; return { data: { id: "FILE1" } }; },
      delete: async (a: any) => { calls.deleted.push(a.fileId); },
      get: async () => { if (o.getErr) throw o.getErr; return { data: o.getData ?? { id: "f", name: "南得遇見你_學生投稿", mimeType: "application/vnd.google-apps.folder", capabilities: { canAddChildren: true } } }; },
    },
    permissions: { create: async (a: any) => { calls.perms.push(a); if (o.permErr) throw o.permErr; return {}; } },
    about: { get: async () => ({ data: { user: { emailAddress: "admin@gmail.test" } } }) },
  };
  return { d, calls };
}
const activeRow = (): AuthRow => ({ refreshTokenEnc: encryptToken("RT-secret", ENV.GOOGLE_TOKEN_ENCRYPTION_KEY!), accountEmail: "a@b", scope: DRIVE_SCOPE, status: "active", lastError: null, connectedAt: new Date() });

(async () => {
  console.log("Google Drive OAuth 測試");
  await t("授權網址：offline + consent + drive scope + state，且 redirect_uri 正確", () => {
    const { cfg } = readOAuthEnv(ENV);
    const u = new URL(buildAuthUrl(createOAuthClient(cfg), "STATE.X"));
    assert.equal(u.searchParams.get("access_type"), "offline"); assert.equal(u.searchParams.get("prompt"), "consent");
    assert.equal(u.searchParams.get("scope"), DRIVE_SCOPE); assert.equal(u.searchParams.get("state"), "STATE.X");
    assert.equal(u.searchParams.get("response_type"), "code");
    assert.equal(u.searchParams.get("redirect_uri"), "https://nande-platform.vercel.app/api/admin/google-drive/callback");
    assert.ok(!u.search.includes(ENV.GOOGLE_OAUTH_CLIENT_SECRET!));
  });
  await t("driveMode：全空 off、缺一項 misconfigured、齊全 on；缺少清單不含值", () => {
    assert.equal(driveMode({}), "off");
    const part = { ...ENV, GOOGLE_TOKEN_ENCRYPTION_KEY: "" }; assert.equal(driveMode(part), "misconfigured");
    assert.deepEqual(readOAuthEnv(part).missing.map((x) => x.split("（")[0]), ["GOOGLE_TOKEN_ENCRYPTION_KEY"]);
    assert.equal(driveMode(ENV), "on");
    assert.equal(readOAuthEnv({ ...ENV, GOOGLE_OAUTH_REDIRECT_URI: "https://x.test/cb" }).cfg.redirectUri, "https://x.test/cb");
  });
  await t("state：正確通過；cookie 不符、簽章被改、換管理員、缺值、舊 cookie 都被拒絕", () => {
    const { nonce, state } = createState("admin1", SECRET);
    assert.ok(verifyState({ state, cookieNonce: nonce, adminId: "admin1", secret: SECRET }));
    assert.ok(!verifyState({ state, cookieNonce: "other", adminId: "admin1", secret: SECRET }));
    assert.ok(!verifyState({ state: state.slice(0, -2) + "xx", cookieNonce: nonce, adminId: "admin1", secret: SECRET }));
    assert.ok(!verifyState({ state, cookieNonce: nonce, adminId: "admin2", secret: SECRET }));
    assert.ok(!verifyState({ state, cookieNonce: nonce, adminId: "admin1", secret: "wrong" }));
    assert.ok(!verifyState({ state: null, cookieNonce: nonce, adminId: "admin1", secret: SECRET }));
    assert.ok(!verifyState({ state, cookieNonce: null, adminId: "admin1", secret: SECRET }));
    assert.ok(!verifyState({ state: "nodot", cookieNonce: "nodot", adminId: "admin1", secret: SECRET }));
    const b = createState("admin1", SECRET); assert.notEqual(b.state, state);
  });
  await t("Refresh Token 加密：可還原、每次密文不同、不含明文、竄改／錯誤金鑰會失敗", () => {
    const k = ENV.GOOGLE_TOKEN_ENCRYPTION_KEY!; const a = encryptToken("RT-plain", k), b = encryptToken("RT-plain", k);
    assert.notEqual(a, b); assert.ok(!a.includes("RT-plain")); assert.equal(decryptToken(a, k), "RT-plain");
    assert.throws(() => decryptToken(a, "x".repeat(32)));
    assert.throws(() => decryptToken(a.slice(0, -3) + "AAA", k)); assert.throws(() => decryptToken("garbage", k));
  });
  await t("callback 成功：加密保存 Refresh Token，資料庫內容不含明文", async () => {
    const m = memStore(); const { c, calls } = fakeClient({ tokens: { refresh_token: "RT-NEW", access_token: "AT", scope: DRIVE_SCOPE } }); const { d } = fakeDrive();
    const r = await completeAuthorization(uc(), "adm", { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => d });
    assert.equal(r.email, "admin@gmail.test"); const row = m.get()!;
    assert.ok(!JSON.stringify(row).includes("RT-NEW")); assert.equal(decryptToken(row.refreshTokenEnc, ENV.GOOGLE_TOKEN_ENCRYPTION_KEY!), "RT-NEW"); assert.deepEqual(calls.revoked, []);
  });
  await t("callback：沒有 Refresh Token → DRIVE_NO_REFRESH_TOKEN 且不保存", async () => {
    const m = memStore(); const { c } = fakeClient({ tokens: { access_token: "AT", scope: DRIVE_SCOPE } });
    await assert.rejects(completeAuthorization(uc(), null, { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => fakeDrive().d }), (e: DriveError) => e.code === "DRIVE_NO_REFRESH_TOKEN");
    assert.equal(m.get(), null);
  });
  await t("callback：沒勾 Drive 權限 → DRIVE_SCOPE_MISSING，token 被撤銷、不保存", async () => {
    const m = memStore(); const { c, calls } = fakeClient({ tokens: { refresh_token: "RT", scope: "openid" } });
    await assert.rejects(completeAuthorization(uc(), null, { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => fakeDrive().d }), (e: DriveError) => e.code === "DRIVE_SCOPE_MISSING");
    assert.deepEqual(calls.revoked, ["RT"]); assert.equal(m.get(), null);
  });
  await t("callback：授權碼無效 → DRIVE_EXCHANGE_FAILED", async () => {
    const { c } = fakeClient({ getTokenErr: gErr(400, "invalid_grant") });
    await assert.rejects(completeAuthorization(uc(), null, { store: memStore().store, env: ENV, makeClient: () => c }), (e: DriveError) => e.code === "DRIVE_EXCHANGE_FAILED");
  });
  await t("callback：Gmail 無法寫入指定資料夾 → DRIVE_FOLDER_INACCESSIBLE，不保存、token 撤銷", async () => {
    const m = memStore(); const { c, calls } = fakeClient({ tokens: { refresh_token: "RT", scope: DRIVE_SCOPE } });
    await assert.rejects(completeAuthorization(uc(), null, { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => fakeDrive({ getErr: gErr(404) }).d }), (e: DriveError) => e.code === "DRIVE_FOLDER_INACCESSIBLE");
    assert.equal(m.get(), null); assert.deepEqual(calls.revoked, ["RT"]);
    await assert.rejects(completeAuthorization(uc(), null, { store: m.store, env: ENV, makeClient: () => fakeClient({ tokens: { refresh_token: "R2", scope: DRIVE_SCOPE } }).c, makeDrive: () => fakeDrive({ getData: { mimeType: "image/png" } }).d }), (e: DriveError) => e.code === "DRIVE_FOLDER_INACCESSIBLE");
  });
  await t("上傳成功：用 Refresh Token 取得 Access Token、寫入指定資料夾、設為連結可檢視", async () => {
    const m = memStore(activeRow()); const { c, calls: cc } = fakeClient(); const { d, calls } = fakeDrive();
    const r = await uploadBufferViaOAuth({ buffer: Buffer.from("x"), filename: "a.jpg", mimeType: "image/jpeg" }, { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => d });
    assert.deepEqual(r, { fileId: "FILE1", viewUrl: "https://drive.google.com/uc?id=FILE1" });
    assert.deepEqual(cc.creds, { refresh_token: "RT-secret" }); assert.deepEqual(calls.created[0].requestBody.parents, ["folder123456"]);
    assert.equal(calls.perms[0].requestBody.type, "anyone");
  });
  await t("上傳：尚未授權 → DRIVE_NOT_AUTHORIZED；已撤銷 → DRIVE_AUTH_REVOKED", async () => {
    const p = { buffer: Buffer.from("x"), filename: "a.jpg", mimeType: "image/jpeg" };
    await assert.rejects(uploadBufferViaOAuth(p, { store: memStore().store, env: ENV }), (e: DriveError) => e.code === "DRIVE_NOT_AUTHORIZED");
    await assert.rejects(uploadBufferViaOAuth(p, { store: memStore({ ...activeRow(), status: "revoked" }).store, env: ENV }), (e: DriveError) => e.code === "DRIVE_AUTH_REVOKED");
  });
  await t("上傳：Refresh Token 被撤銷／過期（invalid_grant）→ 標記 revoked 並回 DRIVE_AUTH_REVOKED", async () => {
    const m = memStore(activeRow()); const { c } = fakeClient({ accessErr: gErr(400, "invalid_grant") });
    await assert.rejects(uploadBufferViaOAuth({ buffer: Buffer.from("x"), filename: "a", mimeType: "image/png" }, { store: m.store, env: ENV, makeClient: () => c }), (e: DriveError) => e.code === "DRIVE_AUTH_REVOKED");
    assert.equal(m.get()!.status, "revoked");
  });
  await t("上傳：加密金鑰換過（無法解密）→ DRIVE_AUTH_REVOKED，不洩漏細節", async () => {
    const m = memStore(activeRow());
    await assert.rejects(uploadBufferViaOAuth({ buffer: Buffer.from("x"), filename: "a", mimeType: "image/png" }, { store: m.store, env: { ...ENV, GOOGLE_TOKEN_ENCRYPTION_KEY: "z".repeat(32) } }), (e: DriveError) => e.code === "DRIVE_AUTH_REVOKED");
  });
  await t("上傳：資料夾 404 → DRIVE_FOLDER_INACCESSIBLE；分享權限失敗 → 刪除剛建立的檔案並回 DRIVE_UPLOAD_FAILED", async () => {
    const p = { buffer: Buffer.from("x"), filename: "a", mimeType: "image/png" };
    await assert.rejects(uploadBufferViaOAuth(p, { store: memStore(activeRow()).store, env: ENV, makeClient: () => fakeClient().c, makeDrive: () => fakeDrive({ createErr: gErr(404) }).d }), (e: DriveError) => e.code === "DRIVE_FOLDER_INACCESSIBLE");
    const fd = fakeDrive({ permErr: gErr(403, "forbidden") });
    await assert.rejects(uploadBufferViaOAuth(p, { store: memStore(activeRow()).store, env: ENV, makeClient: () => fakeClient().c, makeDrive: () => fd.d }), (e: DriveError) => e.code === "DRIVE_UPLOAD_FAILED");
    assert.deepEqual(fd.calls.deleted, ["FILE1"]);
  });
  await t("上傳：暫時性 503 會重試後成功", async () => {
    let n = 0; const base = fakeDrive();
    const d = { ...base.d, files: { ...base.d.files, create: async (a: any) => { if (n++ < 1) throw gErr(503); return base.d.files.create(a); } } };
    const r = await uploadBufferViaOAuth({ buffer: Buffer.from("x"), filename: "a", mimeType: "image/png" }, { store: memStore(activeRow()).store, env: ENV, makeClient: () => fakeClient().c, makeDrive: () => d });
    assert.equal(r.fileId, "FILE1"); assert.equal(n, 2);
  });
  await t("檢查連線不建立任何檔案；中斷連線會撤銷並清除；status 不含 token", async () => {
    const m = memStore(activeRow()); const fd = fakeDrive(); const { c, calls } = fakeClient();
    const r = await testConnection({ store: m.store, env: ENV, makeClient: () => c, makeDrive: () => fd.d }); assert.ok(r.name); assert.equal(fd.calls.created.length, 0);
    const sum = await statusSummary({ store: m.store, env: ENV }); const j = JSON.stringify(sum);
    assert.ok(sum.authorized && !j.includes("RT-secret") && !j.includes(ENV.GOOGLE_OAUTH_CLIENT_SECRET!) && !j.includes("refreshTokenEnc") && !j.includes(ENV.GOOGLE_TOKEN_ENCRYPTION_KEY!));
    await disconnect({ store: m.store, env: ENV, makeClient: () => c }); assert.deepEqual(calls.revoked, ["RT-secret"]); assert.equal(m.get(), null);
  });
  await t("資料表不存在（P2021）→ DRIVE_TABLE_MISSING；status 標示 tableMissing", async () => {
    const store = prismaDriveAuthStore({ googleDriveAuth: { findUnique: async () => { throw Object.assign(new Error("x"), { code: "P2021" }); } } });
    await assert.rejects(store.get(), (e: DriveError) => e.code === "DRIVE_TABLE_MISSING");
    assert.equal((await statusSummary({ store, env: ENV })).tableMissing, true);
  });
  await t("日誌用的錯誤描述不含 token／secret（即使原始錯誤物件帶有）", () => {
    const e = Object.assign(new Error("Request failed"), { config: { headers: { Authorization: "Bearer AT-LEAK" }, data: "refresh_token=RT-LEAK&client_secret=CS-LEAK" }, response: { status: 401, data: { error: "invalid_grant" } } });
    const s = describeError(e); assert.ok(!/LEAK/.test(s) && s.includes("invalid_grant"));
  });
  // ── 授權碼交換：用「真正的 google-auth-library」打到本機假的 Token Endpoint ──
  console.log("\n授權碼交換與錯誤紀錄");
  type Seen = { method?: string; url?: string; ctype?: string; form?: Record<string, string> };
  async function tokenServer(reply: (form: Record<string, string>, n: number) => { status: number; body: unknown }) {
    const seen: Seen[] = [];
    const srv = http.createServer((req, res) => {
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
        const form = Object.fromEntries(new URLSearchParams(b)); seen.push({ method: req.method, url: req.url, ctype: String(req.headers["content-type"]), form });
        const r = reply(form, seen.length); res.writeHead(r.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(r.body));
      });
    });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/token`;
    const makeClient = (cfg: OAuthConfig) => new OAuth2Client({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: cfg.redirectUri, endpoints: { oauth2TokenUrl: url } });
    return { seen, makeClient, close: () => new Promise((ok) => srv.close(ok)) };
  }
  const AUTH_CODE = "4/0AX4XfWh-authcode-" + "Z".repeat(40);
  const ACCESS = "ya29.a0-access-" + "A".repeat(30), REFRESH = "1//0g-refresh-" + "R".repeat(30);
  const ALL_SECRETS = [ENV.GOOGLE_OAUTH_CLIENT_SECRET!, ENV.GOOGLE_TOKEN_ENCRYPTION_KEY!, SECRET, AUTH_CODE, ACCESS, REFRESH, "cookie-nonce-VALUE-123"];
  const leaks = (text: string) => ALL_SECRETS.filter((x) => text.includes(x));

  await t("POST 格式：Token Endpoint 收到 form-encoded，含 grant_type／code／client_id／client_secret／與授權時相同的 redirect_uri", async () => {
    const srv = await tokenServer(() => ({ status: 200, body: { refresh_token: REFRESH, access_token: ACCESS, scope: DRIVE_SCOPE, token_type: "Bearer", expires_in: 3599 } }));
    try {
      const m = memStore();
      await completeAuthorization(AUTH_CODE + "1", "adm", { store: m.store, env: ENV, makeClient: srv.makeClient, makeDrive: () => fakeDrive().d });
      const q = srv.seen[0]!; assert.equal(q.method, "POST"); assert.match(q.ctype!, /application\/x-www-form-urlencoded/); assert.equal(q.url, "/token");
      assert.equal(q.form!.grant_type, "authorization_code"); assert.equal(q.form!.code, AUTH_CODE + "1"); assert.equal(q.form!.client_id, ENV.GOOGLE_OAUTH_CLIENT_ID);
      assert.equal(q.form!.client_secret, ENV.GOOGLE_OAUTH_CLIENT_SECRET);
      // 授權網址用的 redirect_uri 與換碼用的完全相同
      const authUri = new URL(buildAuthUrl(createOAuthClient(readOAuthEnv(ENV).cfg), "S.S")).searchParams.get("redirect_uri");
      assert.equal(q.form!.redirect_uri, authUri); assert.equal(authUri, "https://nande-platform.vercel.app/api/admin/google-drive/callback");
      assert.equal(srv.seen.length, 1);
    } finally { await srv.close(); }
  });
  await t("Google 回 invalid_client：紀錄含 stage／HTTP 400／google_error／提示，且不含任何機密", async () => {
    const srv = await tokenServer(() => ({ status: 401, body: { error: "invalid_client", error_description: `Unauthorized for secret ${ENV.GOOGLE_OAUTH_CLIENT_SECRET} code=${AUTH_CODE}` } }));
    try {
      let err: DriveError | null = null;
      try { await completeAuthorization(AUTH_CODE, "adm", { store: memStore().store, env: ENV, makeClient: srv.makeClient }); } catch (e) { err = e as DriveError; }
      assert.ok(err instanceof DriveError); assert.equal(err!.code, "DRIVE_EXCHANGE_FAILED");
      assert.equal(err!.diag!.stage, "token-exchange"); assert.equal(err!.diag!.httpStatus, 401); assert.equal(err!.diag!.googleError, "invalid_client");
      const line = describeError(err); assert.match(line, /stage=token-exchange/); assert.match(line, /status=401/); assert.match(line, /google_error=invalid_client/); assert.match(line, /hint="Client ID／Client Secret/);
      assert.deepEqual(leaks(line + JSON.stringify(err!.diag) + err!.message + String(err!.stack)), []);
      assert.ok(line.includes("[REDACTED]"));
    } finally { await srv.close(); }
  });
  await t("Google 回 invalid_grant／redirect_uri_mismatch：各自帶出可辨識的原因與提示", async () => {
    for (const [ge, hint] of [["invalid_grant", /授權碼已使用/], ["redirect_uri_mismatch", /redirect_uri 與 Google Cloud/]] as const) {
      const srv = await tokenServer(() => ({ status: 400, body: { error: ge, error_description: "Bad Request" } }));
      try {
        const err = await completeAuthorization(AUTH_CODE + ge, null, { store: memStore().store, env: ENV, makeClient: srv.makeClient }).then(() => null, (e) => e as DriveError);
        assert.equal(err!.diag!.googleError, ge); assert.match(describeError(err), hint); assert.equal(err!.diag!.httpStatus, 400);
      } finally { await srv.close(); }
    }
  });
  await t("同一授權碼送出兩次：第二次不會再打 Google，stage=duplicate-code", async () => {
    const srv = await tokenServer(() => ({ status: 400, body: { error: "invalid_grant" } }));
    try {
      const dep = { store: memStore().store, env: ENV, makeClient: srv.makeClient };
      await completeAuthorization("dup-code-" + "d".repeat(20), null, dep).catch(() => undefined);
      const err = await completeAuthorization("dup-code-" + "d".repeat(20), null, dep).then(() => null, (e) => e as DriveError);
      assert.equal(err!.diag!.stage, "duplicate-code"); assert.equal(srv.seen.length, 1);
    } finally { await srv.close(); }
  });
  await t("網路層失敗（連不到 Token Endpoint）：記錄 net code，不含機密", async () => {
    const mk = (cfg: OAuthConfig) => new OAuth2Client({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: cfg.redirectUri, endpoints: { oauth2TokenUrl: "http://127.0.0.1:1/token" } });
    const err = await completeAuthorization(AUTH_CODE + "net", null, { store: memStore().store, env: ENV, makeClient: mk }).then(() => null, (e) => e as DriveError);
    assert.equal(err!.code, "DRIVE_EXCHANGE_FAILED"); assert.equal(err!.diag!.stage, "token-exchange"); assert.ok(err!.diag!.netCode || err!.diag!.description);
    assert.deepEqual(leaks(describeError(err)), []);
  });
  await t("換碼成功後的失敗不再被誤報成『授權碼失敗』：帳號驗證失敗／資料庫寫入失敗各有自己的代碼與 stage，且 token 被撤銷", async () => {
    const tok = { refresh_token: REFRESH, access_token: ACCESS, scope: DRIVE_SCOPE };
    // 帳號驗證失敗
    let fc = fakeClient({ tokens: tok }); const bad = fakeDrive(); (bad.d as any).about.get = async () => { throw Object.assign(new Error(`denied ${ACCESS}`), { response: { status: 403, data: { error: { message: `Drive API disabled for ${ACCESS}`, errors: [{ reason: "accessNotConfigured" }] } } } }); };
    let err = await completeAuthorization("c-verify-" + "v".repeat(20), null, { store: memStore().store, env: ENV, makeClient: () => fc.c, makeDrive: () => bad.d }).then(() => null, (e) => e as DriveError);
    assert.equal(err!.code, "DRIVE_VERIFY_FAILED"); assert.equal(err!.diag!.stage, "account-check"); assert.equal(err!.diag!.httpStatus, 403); assert.equal(err!.diag!.googleError, "accessNotConfigured");
    assert.deepEqual(fc.calls.revoked, [REFRESH]); assert.deepEqual(leaks(describeError(err) + err!.message), []);
    // 資料庫寫入失敗（錯誤文字含連線字串與密碼）
    fc = fakeClient({ tokens: tok }); const m = memStore(); m.store.save = async () => { throw new Error(`connect failed postgres://u:${ENV.GOOGLE_TOKEN_ENCRYPTION_KEY}@host/db`); };
    err = await completeAuthorization("c-store-" + "s".repeat(20), null, { store: m.store, env: ENV, makeClient: () => fc.c, makeDrive: () => fakeDrive().d }).then(() => null, (e) => e as DriveError);
    assert.equal(err!.code, "DRIVE_STORE_FAILED"); assert.equal(err!.diag!.stage, "db-save"); assert.equal(err!.diag!.description, undefined);
    assert.deepEqual(fc.calls.revoked, [REFRESH]); assert.ok(!describeError(err).includes("postgres://")); assert.deepEqual(leaks(describeError(err) + err!.message), []);
  });
  await t("sanitizeText：機密值、token 格式、Bearer、URL 參數、email 與長字串都被遮蔽並限制長度", () => {
    const raw = `Bearer ${ACCESS} code=${AUTH_CODE}&client_secret=abc123XYZ789 ${REFRESH} ${ENV.GOOGLE_OAUTH_CLIENT_SECRET} me@gmail.test ${"x".repeat(80)}`;
    const out = sanitizeText(raw, [ENV.GOOGLE_OAUTH_CLIENT_SECRET]);
    assert.deepEqual(leaks(out), []); assert.ok(!out.includes("abc123XYZ789")); assert.ok(!out.includes("me@gmail.test")); assert.ok(out.length <= 201);
    assert.equal(sanitizeText("Unauthorized"), "Unauthorized");
  });
  await t("所有失敗路徑的日誌行：逐一檢查不含 Client Secret／授權碼／Access／Refresh／加密金鑰／NEXTAUTH_SECRET／Cookie", async () => {
    const lines: string[] = [];
    Object.assign(process.env, ENV); // 正式環境的機密就在 process.env 裡；過濾器會自己取用
    const SAFE_TEXT = ALL_SECRETS.slice(0, 6).join(" ") + " Cookie: cookie-nonce-VALUE-123";
    const gx = (data: unknown) => Object.assign(new Error(`failed ${ALL_SECRETS.join(" ")}`), { config: { headers: { Authorization: `Bearer ${ACCESS}`, Cookie: "cookie-nonce-VALUE-123" }, data: `code=${AUTH_CODE}&client_secret=${ENV.GOOGLE_OAUTH_CLIENT_SECRET}` }, response: { status: 400, data } });
    for (const [i, d] of ([{ error: "invalid_client", error_description: SAFE_TEXT }, { error: { message: SAFE_TEXT, errors: [{ reason: "x" }] } }, undefined] as const).entries()) {
      const srv = await tokenServer(() => ({ status: 400, body: d ?? {} }));
      try {
        const e1 = await completeAuthorization(AUTH_CODE + "all" + i, null, { store: memStore().store, env: ENV, makeClient: srv.makeClient }).then(() => null, (e) => e);
        lines.push(describeError(e1), JSON.stringify((e1 as DriveError).diag), (e1 as DriveError).message);
      } finally { await srv.close(); }
      lines.push(describeError(gx(d)), JSON.stringify(diagnose(gx(d), "x", ALL_SECRETS)));
    }
    lines.push(describeError(gx({ error: "invalid_grant" })));
    assert.deepEqual(leaks(lines.join("\n")), []);
    assert.ok(lines.every((l) => !/client_secret=|Bearer ya29/.test(l)));
  });
  await t("環境變數整理：外層多貼的引號與空白會去掉；加密金鑰不被修改", () => {
    assert.equal(cleanEnv('  "abc-123"\n'), "abc-123"); assert.equal(cleanEnv("'x y'"), "x y"); assert.equal(cleanEnv(undefined), ""); assert.equal(cleanEnv('a"b'), 'a"b');
    const q = readOAuthEnv({ ...ENV, GOOGLE_OAUTH_CLIENT_SECRET: `"${ENV.GOOGLE_OAUTH_CLIENT_SECRET}"`, GOOGLE_TOKEN_ENCRYPTION_KEY: `"${ENV.GOOGLE_TOKEN_ENCRYPTION_KEY}"` }).cfg;
    assert.equal(q.clientSecret, ENV.GOOGLE_OAUTH_CLIENT_SECRET); assert.equal(q.encryptionKey, `"${ENV.GOOGLE_TOKEN_ENCRYPTION_KEY}"`);
    assert.equal(hintFor({ stage: "token-exchange", googleError: "invalid_client" }).includes("引號"), true);
  });

  // ── 回歸：審核通過上傳時 "Cannot read properties of undefined (reading 'from')" ──
  console.log("\n上傳回歸測試（Readable.from 錯誤）");
  await t("回歸：Drive 相關程式不得用動態 import 載入 Node 內建模組（webpack 打包後 Readable 會變 undefined）", () => {
    for (const f of ["lib/googleDriveOAuth.ts", "lib/driveService.ts", "app/api/admin/uploads/[id]/route.ts"]) {
      const src = fs.readFileSync(path.join(__dirname, "../..", f), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
      assert.ok(!/import\(\s*["'](node:)?(stream|fs|crypto|buffer|path)["']\s*\)/.test(src), f + " 含動態 import 內建模組");
      assert.ok(!/\brequire\(\s*["']stream["']\s*\)/.test(src), f + " 含 require(stream)");
    }
    const lib = fs.readFileSync(path.join(__dirname, "../../lib/googleDriveOAuth.ts"), "utf8");
    assert.match(lib, /^import \{ Readable \} from "stream";/m);
  });
  await t("bufferToStream：位元組完整、非 Buffer 會明確報錯、每次呼叫都是新的 stream", async () => {
    const buf = Buffer.from(Array.from({ length: 70000 }, (_, i) => i % 251));
    const a = bufferToStream(buf), b = bufferToStream(buf); assert.notStrictEqual(a, b);
    const chunks: Buffer[] = []; for await (const c of a) chunks.push(Buffer.from(c));
    assert.ok(Buffer.concat(chunks).equals(buf));
    assert.throws(() => bufferToStream("text" as unknown as Buffer), /Buffer/); assert.throws(() => bufferToStream(undefined as unknown as Buffer), /Buffer/);
  });
  await t("回歸：用「真正的 googleapis」把 stream 以 multipart 上傳到本機假 Drive；資料夾、檔名、MIME、位元組都正確，並設為連結可檢視", async () => {
    const img = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(Array.from({ length: 3000 }, (_, i) => (i * 7) % 256)), Buffer.from([0xff, 0xd9])]);
    const seen: { url?: string; method?: string; ctype?: string; auth?: string; body?: Buffer }[] = [];
    const srv = http.createServer((req, res) => {
      const parts: Buffer[] = []; req.on("data", (c) => parts.push(c)); req.on("end", () => {
        seen.push({ url: req.url, method: req.method, ctype: String(req.headers["content-type"]), auth: String(req.headers.authorization), body: Buffer.concat(parts) });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(req.url!.includes("/permissions") ? { id: "perm1" } : { id: "FILE-REAL-1" }));
      });
    });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const root = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/`;
    const tok = await tokenServer(() => ({ status: 200, body: { access_token: ACCESS, expires_in: 3599, token_type: "Bearer" } }));
    try {
      const r = await uploadBufferViaOAuth({ buffer: img, filename: "sub-1.jpg", mimeType: "image/jpeg" }, {
        store: memStore(activeRow()).store, env: ENV, makeClient: tok.makeClient,
        // googleapis 的 rootUrl 只能在「每次呼叫」時指定；包一層把請求導到本機假 Drive，其餘（stream、multipart）都走真正的 googleapis
        makeDrive: (client) => {
          const real = google.drive({ version: "v3", auth: client }); const o = { rootUrl: root };
          return {
            files: { create: (p: any) => real.files.create(p, o), delete: (p: any) => real.files.delete(p, o), get: (p: any) => real.files.get(p, o) },
            permissions: { create: (p: any) => real.permissions.create(p, o) },
            about: { get: (p: any) => real.about.get(p, o) },
          };
        },
      });
      assert.deepEqual(r, { fileId: "FILE-REAL-1", viewUrl: "https://drive.google.com/uc?id=FILE-REAL-1" });
      assert.equal(tok.seen[0]!.form!.grant_type, "refresh_token"); assert.equal(tok.seen[0]!.form!.refresh_token, "RT-secret");
      const up = seen.find((x) => x.url!.includes("/upload/drive/v3/files"))!; assert.equal(up.method, "POST");
      assert.match(up.ctype!, /^multipart\/related/); assert.equal(up.auth, "Bearer " + ACCESS);
      assert.ok(up.url!.includes("uploadType=multipart"));
      const text = up.body!.toString("latin1");
      assert.ok(text.includes('"name":"sub-1.jpg"') && text.includes('"folder123456"') && /content-type: image\/jpeg/i.test(text));
      assert.ok(up.body!.includes(img), "上傳內容的位元組必須完整出現在 multipart 內");
      const perm = seen.find((x) => x.url!.includes("/permissions"))!; assert.equal(perm.method, "POST"); assert.ok(perm.url!.includes("FILE-REAL-1"));
      assert.deepEqual(JSON.parse(perm.body!.toString()), { role: "reader", type: "anyone" });
    } finally { await tok.close(); await new Promise((ok) => srv.close(ok)); }
  });
  await t("回歸：上傳程式本身的 TypeError 不會被當成『Google 錯誤』吞掉——日誌帶 stage=upload 與原始訊息（且仍不含機密）", async () => {
    const err = await uploadBufferViaOAuth({ buffer: "not-a-buffer" as unknown as Buffer, filename: "a.jpg", mimeType: "image/jpeg" }, { store: memStore(activeRow()).store, env: ENV, makeClient: () => fakeClient().c, makeDrive: () => fakeDrive().d }).then(() => null, (e) => e as DriveError);
    assert.equal(err!.code, "DRIVE_UPLOAD_FAILED"); assert.equal(err!.diag!.stage, "upload"); assert.match(describeError(err), /Buffer/); assert.deepEqual(leaks(describeError(err)), []);
  });

  console.log(`\n通過 ${pass}，失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
