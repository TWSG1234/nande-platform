/** Google Drive 個人 Gmail OAuth 測試：全部使用假的 Google 用戶端與記憶體儲存，不連網、不碰資料庫。 */
import assert from "assert";
import { OAuth2Client } from "google-auth-library";
import {
  buildAuthUrl, completeAuthorization, createOAuthClient, createState, decryptToken, describeError, disconnect, DriveAuthStore, DriveError,
  driveMode, DRIVE_SCOPE, encryptToken, prismaDriveAuthStore, readOAuthEnv, statusSummary, testConnection, uploadBufferViaOAuth, verifyState, AuthRow,
} from "../../lib/googleDriveOAuth";

const SECRET = "test-nextauth-" + process.pid;
const ENV: Env = {
  GOOGLE_OAUTH_CLIENT_ID: "cid.apps.test", GOOGLE_OAUTH_CLIENT_SECRET: "csecret-" + process.pid, GOOGLE_DRIVE_FOLDER_ID: "folder123456",
  GOOGLE_TOKEN_ENCRYPTION_KEY: "enc-key-" + "k".repeat(30), NEXTAUTH_URL: "https://nande-platform.vercel.app/", NEXTAUTH_SECRET: SECRET,
};
type Env = Record<string, string | undefined>;
let pass = 0, fail = 0;
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
    const r = await completeAuthorization("code", "adm", { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => d });
    assert.equal(r.email, "admin@gmail.test"); const row = m.get()!;
    assert.ok(!JSON.stringify(row).includes("RT-NEW")); assert.equal(decryptToken(row.refreshTokenEnc, ENV.GOOGLE_TOKEN_ENCRYPTION_KEY!), "RT-NEW"); assert.deepEqual(calls.revoked, []);
  });
  await t("callback：沒有 Refresh Token → DRIVE_NO_REFRESH_TOKEN 且不保存", async () => {
    const m = memStore(); const { c } = fakeClient({ tokens: { access_token: "AT", scope: DRIVE_SCOPE } });
    await assert.rejects(completeAuthorization("c", null, { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => fakeDrive().d }), (e: DriveError) => e.code === "DRIVE_NO_REFRESH_TOKEN");
    assert.equal(m.get(), null);
  });
  await t("callback：沒勾 Drive 權限 → DRIVE_SCOPE_MISSING，token 被撤銷、不保存", async () => {
    const m = memStore(); const { c, calls } = fakeClient({ tokens: { refresh_token: "RT", scope: "openid" } });
    await assert.rejects(completeAuthorization("c", null, { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => fakeDrive().d }), (e: DriveError) => e.code === "DRIVE_SCOPE_MISSING");
    assert.deepEqual(calls.revoked, ["RT"]); assert.equal(m.get(), null);
  });
  await t("callback：授權碼無效 → DRIVE_EXCHANGE_FAILED", async () => {
    const { c } = fakeClient({ getTokenErr: gErr(400, "invalid_grant") });
    await assert.rejects(completeAuthorization("c", null, { store: memStore().store, env: ENV, makeClient: () => c }), (e: DriveError) => e.code === "DRIVE_EXCHANGE_FAILED");
  });
  await t("callback：Gmail 無法寫入指定資料夾 → DRIVE_FOLDER_INACCESSIBLE，不保存、token 撤銷", async () => {
    const m = memStore(); const { c, calls } = fakeClient({ tokens: { refresh_token: "RT", scope: DRIVE_SCOPE } });
    await assert.rejects(completeAuthorization("c", null, { store: m.store, env: ENV, makeClient: () => c, makeDrive: () => fakeDrive({ getErr: gErr(404) }).d }), (e: DriveError) => e.code === "DRIVE_FOLDER_INACCESSIBLE");
    assert.equal(m.get(), null); assert.deepEqual(calls.revoked, ["RT"]);
    await assert.rejects(completeAuthorization("c", null, { store: m.store, env: ENV, makeClient: () => fakeClient({ tokens: { refresh_token: "R2", scope: DRIVE_SCOPE } }).c, makeDrive: () => fakeDrive({ getData: { mimeType: "image/png" } }).d }), (e: DriveError) => e.code === "DRIVE_FOLDER_INACCESSIBLE");
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
  console.log(`\n通過 ${pass}，失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
