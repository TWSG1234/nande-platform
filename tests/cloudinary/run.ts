/**
 * Cloudinary 驅動測試（npm run test:cloudinary）。
 * 不連真正的 Cloudinary、不需要任何金鑰：用本機「假 Cloudinary 伺服器」搭配真正的官方 SDK，
 * 假伺服器會驗證 SDK 送來的簽名。測試用的 Key／Secret 是隨機產生的假值。
 */
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { startFakeCloudinary } from "./fakeCloudinary";

const P = path.resolve(__dirname, "../..") + "/";
function inject(rel: string, exports: any) { const f = require.resolve(P + rel); require.cache[f] = { id: f, filename: f, loaded: true, exports, children: [], paths: [] } as any; }
let pass = 0, fail = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };

const PNG = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"), Buffer.alloc(40, 1)]);
const JPG = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(40, 2)]);
const MP4 = Buffer.concat([Buffer.from("0000002066747970", "hex"), Buffer.alloc(100, 3)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

(async () => {
  const cloud = "demo-" + crypto.randomBytes(3).toString("hex"), key = String(Math.floor(Math.random() * 1e14)), secret = crypto.randomBytes(14).toString("hex");
  const fake = await startFakeCloudinary({ cloud, key, secret });
  const { v2 } = require(P + "node_modules/cloudinary");
  v2.config({ upload_prefix: fake.url, secure: false });
  const C = await import(P + "lib/storage/cloudinary");
  const S = await import(P + "lib/storage/index");
  const mk = (extra: any = {}) => C.createCloudinaryStorage({ cloudName: cloud, apiKey: key, apiSecret: secret, folder: "nande-test", uploader: v2.uploader, api: v2.api, deliveryBase: fake.url, ...extra });

  // ───────── 設定與安全規則 ─────────
  await t("環境變數：缺少時只列出變數「名稱」，不洩漏任何值；支援 CLOUDINARY_URL", () => {
    assert.throws(() => C.cloudinaryConfigFromEnv({} as any), (e: any) => /CLOUDINARY_CLOUD_NAME、CLOUDINARY_API_KEY、CLOUDINARY_API_SECRET/.test(e.message));
    assert.throws(() => C.cloudinaryConfigFromEnv({ CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k" } as any), (e: any) => /CLOUDINARY_API_SECRET/.test(e.message) && !/CLOUDINARY_CLOUD_NAME/.test(e.message));
    const c = C.cloudinaryConfigFromEnv({ CLOUDINARY_URL: "cloudinary://11:abc%2Fd@mycloud" } as any);
    assert.deepEqual([c.cloudName, c.apiKey, c.apiSecret, c.folder, c.deleteMode], ["mycloud", "11", "abc/d", "nande-platform", "trash"]);
    assert.throws(() => C.cloudinaryConfigFromEnv({ CLOUDINARY_URL: "cloudinary://1:2@c", CLOUDINARY_DELETE_MODE: "wipe" } as any), /CLOUDINARY_DELETE_MODE/);
    assert.throws(() => C.cloudinaryConfigFromEnv({ CLOUDINARY_URL: "cloudinary://1:2@c", CLOUDINARY_FOLDER: "../x" } as any), /CLOUDINARY_FOLDER/);
    assert.throws(() => C.cloudinaryConfigFromEnv({ CLOUDINARY_URL: "cloudinary://1:2@c", CLOUDINARY_FOLDER: "a/_trash" } as any), /CLOUDINARY_FOLDER/);
  });
  await t("parseUploadUrl：合法網址通過；穿越／_trash／反斜線／不合法副檔名／三層路徑／外部網址 全拒絕", () => {
    assert.deepEqual(C.parseUploadUrl("/uploads/content/ab-12_x.PNG"), { subdir: "content", filename: "ab-12_x.PNG", base: "ab-12_x", ext: ".png", idDir: "content", idBase: "ab-12_x__png", hashed: false });
    assert.ok(C.parseUploadUrl("/uploads/chinese-animation/a1.mp4")); assert.ok(C.parseUploadUrl("/uploads/chinese-animation/a1.svg")); assert.ok(C.parseUploadUrl("/uploads/home-decor/a.png?v=2"));
    for (const u of ["/uploads/../a.png", "/uploads/content/../../a.png", "/uploads/content/%2e%2e/a.png", "/uploads/_trash/a.png", "/uploads/.x/a.png", "/uploads/content/a\\b.png", "/uploads/content/a.php", "/uploads/content/a.png.php", "/uploads/content/a.exe", "/uploads/content/a.mp4", "/uploads/content/a.svg", "/uploads/content/", "/uploads/a/b/c/d/e/f/g.png", "/uploads/content/noext", "/uploads/content/.png", "https://res.cloudinary.com/x/a.png", "/images/a.png", "", null, undefined])
      assert.equal(C.parseUploadUrl(u as any), null, String(u));
  });

  // ───────── 真正的 SDK ＋ 假伺服器：上傳／讀取／存在／刪除 ─────────
  const st = mk();
  let url = "", url2 = "";
  await t("上傳 PNG：簽名上傳成功、回傳 /uploads/content/<uuid>.png、public_id＝folder/subdir/uuid", async () => {
    const name = crypto.randomUUID() + ".png"; url = await st.put("content", name, PNG);
    assert.equal(url, "/uploads/content/" + name);
    const up = fake.log.find((l) => l.path.endsWith("/image/upload"))!; assert.ok(up.sigOk, "簽名必須正確");
    assert.equal(up.fields.public_id, `nande-test/content/${name.slice(0, -4)}`); assert.ok(["0", "false"].includes(up.fields.overwrite!)); assert.equal(up.fields.type, "upload");
    assert.ok(fake.assets.has(`image/nande-test/content/${name.slice(0, -4)}`));
  });
  await t("API Secret 只用來產生簽名，沒有出現在送出的任何請求內容或欄位裡", () => {
    for (const l of fake.log.filter((x) => !x.path.includes("/resources/"))) { assert.ok(!l.raw.includes(secret), "請求內容含 Secret！"); assert.ok(!("api_secret" in l.fields)); assert.ok(l.fields.signature && l.fields.timestamp && l.fields.api_key === key); }
  });
  await t("（準備）再上傳一張供後續檢查", async () => { url2 = await st.put("content", crypto.randomUUID() + ".png", PNG); });
  await t("exists／read：存在 true、內容一致；不存在 false／null", async () => {
    assert.equal(await st.exists(url), true); assert.deepEqual(await st.read(url), PNG);
    assert.equal(await st.exists("/uploads/content/nope.png"), false); assert.equal(await st.read("/uploads/content/nope.png"), null);
    assert.equal(await st.exists("/uploads/_trash/x.png"), false); assert.equal(await st.read("/uploads/../x.png"), null); assert.equal(await st.exists("https://evil/x.png"), false);
  });
  await t("deliveryUrl：組出 https 傳遞網址（資料夾與檔名正確）", () => {
    const real = C.createCloudinaryStorage({ cloudName: "mycloud", apiKey: "1", apiSecret: "s", folder: "nande-platform", uploader: v2.uploader });
    const U1 = "0b8f3c1e-5a2d-4e7b-9c10-2f6a8d4e1b33";
    assert.equal(real.deliveryUrl(`/uploads/content/${U1}.jpg`), `https://res.cloudinary.com/mycloud/image/upload/nande-platform/content/${U1}.jpg`); // UUID 檔名：與舊版完全相同
    assert.equal(real.deliveryUrl("/uploads/content/a1.jpg"), "https://res.cloudinary.com/mycloud/image/upload/nande-platform/content/a1__jpg.jpg"); // 其他檔名：public_id 帶副檔名，避免同名衝突
    assert.equal(real.deliveryUrl("/uploads/chinese-animation/m.mp4"), "https://res.cloudinary.com/mycloud/video/upload/nande-platform/chinese-animation/m__mp4.mp4");
    assert.equal(real.deliveryUrl("/uploads/../a.png"), null);
  });
  await t("【真實帳號回報的問題】上傳前不探測傳遞網址：上傳後立刻 exists／read／Secure URL 都必須成功（CDN 不會被預先快取 404）", async () => {
    const n = fake.log.length; const name = crypto.randomUUID() + ".png"; const u = await st.put("content", name, PNG);
    const secure = st.deliveryUrl(u)!; const r = await fetch(secure); assert.equal(r.status, 200, "Secure URL 公開讀取"); assert.equal(await st.exists(u), true); assert.deepEqual(await st.read(u), PNG); void n;
  });
  await t("CDN 已快取 404 的情況：檔案其實存在時，exists 與 read 仍正確（Admin API 確認＋帶版本號網址）", async () => {
    const name = crypto.randomUUID() + ".png"; const u = "/uploads/content/" + name; const bare = C.createCloudinaryStorage({ cloudName: cloud, apiKey: key, apiSecret: secret, folder: "nande-test", uploader: v2.uploader, deliveryBase: fake.url });
    const secure = bare.deliveryUrl(u)!; assert.equal((await fetch(secure)).status, 404, "先讓傳遞網址回一次 404（被快取）");
    await st.put("content", name, PNG);
    assert.equal((await fetch(secure)).status, 404, "（模擬）快取的 404 仍在，單純 GET 讀不到");
    assert.equal(await st.exists(u), true); assert.deepEqual(await st.read(u), PNG);
    assert.equal(await bare.exists(u), false, "沒有 Admin API 備援的簡版會被快取騙到——這就是正式驅動要帶 api 的原因");
  });
  await t("存在檢查不依賴 HEAD：傳遞網址對 HEAD 回 404（和真實帳號一致）時，exists 仍正確回報 true", async () => {
    const r = await fetch(C.createCloudinaryStorage({ cloudName: cloud, apiKey: key, apiSecret: secret, folder: "nande-test", uploader: v2.uploader, deliveryBase: fake.url }).deliveryUrl(url)!, { method: "HEAD" });
    assert.equal(r.status, 404, "測試環境應模擬 HEAD=404"); assert.equal(await st.exists(url), true);
  });
  await t("不覆蓋（伺服器端保證）：就算上傳前的檢查失靈，overwrite:false 回 existing:true 也會被視為失敗，原圖不變", async () => {
    const name = crypto.randomUUID() + ".png"; const u = await st.put("content", name, PNG);
    const blind = mk(); const realFetch = fetch;
    const blindStore = C.createCloudinaryStorage({ cloudName: cloud, apiKey: key, apiSecret: secret, folder: "nande-test", uploader: v2.uploader, deliveryBase: fake.url, fetchImpl: ((i: any, o: any) => (o?.headers?.Range ? Promise.resolve(new Response(null, { status: 404 })) : realFetch(i, o))) as any });
    const before = fake.assets.size; await assert.rejects(blindStore.put("content", name, Buffer.concat([PNG, Buffer.from("different")])), /已存在/);
    assert.equal(fake.assets.size, before); assert.deepEqual(await st.read(u), PNG, "原圖內容不得被覆蓋"); void blind;
  });
  await t("存在檢查無法判斷（429／5xx）時改問 Admin API；兩邊都失敗就丟錯，不會誤報「不存在」", async () => {
    const flaky = (code: number) => ((i: any, o: any) => Promise.resolve(new Response(null, { status: code }))) as any;
    const withApi = C.createCloudinaryStorage({ cloudName: cloud, apiKey: key, apiSecret: secret, folder: "nande-test", uploader: v2.uploader, api: v2.api, deliveryBase: fake.url, fetchImpl: flaky(429) });
    assert.equal(await withApi.exists(url2), true); assert.equal(await withApi.exists("/uploads/content/never-existed-xyz.png"), false);
    const noApi = C.createCloudinaryStorage({ cloudName: cloud, apiKey: key, apiSecret: secret, folder: "nande-test", uploader: v2.uploader, deliveryBase: fake.url, fetchImpl: flaky(503) });
    await assert.rejects(noApi.exists(url2), /檢查檔案失敗/);
  });
  await t("SDK 設定共用：沒設定全域 cloud_name 時 Admin API 會失敗；applyCloudinaryConfig 之後所有操作都成功", async () => {
    v2.config({ cloud_name: undefined, api_key: undefined, api_secret: undefined });
    await assert.rejects(async () => v2.api.resources({ resource_type: "image", type: "upload", prefix: "nande-test/" }), (e: any) => /cloud_name/i.test(String(e?.message ?? e?.error?.message ?? e)));
    C.applyCloudinaryConfig(v2, { cloudName: cloud, apiKey: key, apiSecret: secret }); v2.config({ upload_prefix: fake.url, secure: false });
    const r = await v2.api.resources({ resource_type: "image", type: "upload", prefix: "nande-test/content/" }); assert.ok(r.resources.length >= 1);
  });
  await t("不覆蓋：同一個檔名再次上傳會失敗，原內容不變", async () => {
    await assert.rejects(st.put("content", url.split("/").pop()!, JPG), /已存在/); assert.deepEqual(await st.read(url), PNG);
  });
  await t("上傳驗證：不合法的子資料夾／檔名在送出前就被拒絕（不呼叫 Cloudinary）", async () => {
    const n = fake.log.length;
    for (const [d, f] of [["../x", "a.png"], ["content", "../a.png"], ["content", "a.php"], ["content", "a.png.php"], ["content", "a?b.png"], ["content", "a#b.png"], ["content", "a%2fb.png"], ["content/../x", "a.png"], ["_trash", "a.png"], ["content", "a.mp4"]]) await assert.rejects(st.put(d!, f!, PNG), /不合法/, d + "/" + f);
    assert.equal(fake.log.length, n);
  });
  await t("allowed_formats：內容不是宣稱的格式時 Cloudinary 端拒絕，錯誤不含 Secret", async () => {
    await assert.rejects(st.put("content", crypto.randomUUID() + ".png", JPG), (e: any) => /Cloudinary 上傳失敗/.test(e.message) && !e.message.includes(secret));
  });
  await t("簽名錯誤（Secret 不對）→ 上傳失敗，且錯誤訊息不含 Secret", async () => {
    const bad = mk({ apiSecret: "wrong-" + secret });
    await assert.rejects(bad.put("content", crypto.randomUUID() + ".png", PNG), (e: any) => /失敗/.test(e.message) && !e.message.includes(secret));
  });
  await t("動畫：MP4 走 video 資源類型、SVG／GIF 走 image；可讀取", async () => {
    const m = await st.put("chinese-animation", crypto.randomUUID() + ".mp4", MP4); const s = await st.put("chinese-animation", crypto.randomUUID() + ".svg", SVG);
    assert.ok(fake.log.some((l) => l.path.endsWith("/video/upload"))); assert.deepEqual(await st.read(m), MP4); assert.equal(await st.exists(s), true);
    assert.equal(await st.exists(m), true);
  });
  await t("其他子資料夾（submissions／home-decor）與 JPG 都能上傳", async () => {
    const a = await st.put("submissions", crypto.randomUUID() + ".jpg", JPG), b = await st.put("home-decor", crypto.randomUUID() + ".png", PNG);
    assert.equal(await st.exists(a), true); assert.equal(await st.exists(b), true);
  });
  await t("刪除（預設 trash）：原網址失效、檔案移到 <folder>/_trash/ 可找回，不是永久刪除", async () => {
    const before = fake.assets.size; await st.remove(url);
    assert.equal(await st.exists(url), false); assert.equal(await st.read(url), null); assert.equal(fake.assets.size, before, "資產數量不變＝只搬移");
    const trash = [...fake.assets.keys()].filter((k) => k.startsWith("image/nande-test/_trash/")); assert.equal(trash.length, 1); assert.ok(trash[0]!.endsWith("-content__" + url.split("/").pop()!.slice(0, -4)));
    assert.ok(fake.log.filter((l) => l.path.endsWith("/rename")).every((l) => l.sigOk && ["1", "true"].includes(l.fields.invalidate!)));
  });
  await t("刪除：不存在／不合法／外部網址／空值 安靜略過，不丟錯、不呼叫刪除", async () => {
    const n = fake.log.length; await st.remove("/uploads/content/never-existed.png");
    await st.remove("/uploads/../a.png"); await st.remove("https://x.com/a.png"); await st.remove(null); await st.remove(""); await st.remove("/images/builtin.png");
    assert.equal(fake.log.length, n + 1, "只有『不存在』那次有送出 rename（得到 404 後略過）");
  });
  await t("刪除（destroy 模式）：永久刪除，資產數量減少", async () => {
    const d = mk({ deleteMode: "destroy" }); const u = await d.put("content", crypto.randomUUID() + ".png", PNG); const n = fake.assets.size;
    await d.remove(u); assert.equal(fake.assets.size, n - 1); assert.equal(await d.exists(u), false);
  });
  await t("傳遞網路錯誤：read 遇到 5xx 丟錯（呼叫端 catch）、沒有 Admin API 備援時 exists 丟錯而不是誤報不存在", async () => {
    const u = await st.put("content", crypto.randomUUID() + ".png", PNG);
    fake.failNextDeliveries(1); await assert.rejects(st.read(u), /HTTP 503/);
    const noApi = mk({ api: undefined }); fake.failNextDeliveries(1); await assert.rejects(noApi.exists(u), /HTTP 503/); assert.equal(await noApi.exists(u), true);
    fake.failNextDeliveries(1); assert.equal(await st.exists(u), true, "有 Admin API 時，傳遞網址暫時故障也能正確判斷");
  });

  // ───────── 驅動選擇 ─────────
  await t("STORAGE_DRIVER：local 預設；cloudinary 缺設定會明確報錯；s3／未知值報錯", async () => {
    const keep = { ...process.env };
    delete process.env.STORAGE_DRIVER; assert.equal(S.getStorageDriver(), "local"); assert.equal(S.getStorage(), S.localStorage);
    process.env.STORAGE_DRIVER = "cloudinary"; assert.equal(S.getStorage(), S.cloudStorage);
    for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_URL"]) delete process.env[k];
    S.__setCloudinaryStorageForTest(null); await assert.rejects(S.getStorage().exists("/uploads/content/a.png"), /STORAGE_DRIVER=cloudinary 需要環境變數/);
    process.env.STORAGE_DRIVER = "s3"; assert.throws(() => S.getStorageDriver(), /cloudinary/); process.env.STORAGE_DRIVER = "ftp"; assert.throws(() => S.getStorageDriver(), /未知/);
    Object.assign(process.env, keep);
  });
  await t("從環境變數建立真正的驅動（SDK 實例）並完成一次上傳／讀取", async () => {
    const keep = { ...process.env };
    Object.assign(process.env, { STORAGE_DRIVER: "cloudinary", CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret, CLOUDINARY_FOLDER: "nande-env" });
    const real = await C.createCloudinaryStorageFromEnv(process.env);
    // 把傳遞網址導到假伺服器：用同一個 SDK，只是 deliveryBase 不同
    const viaEnv = C.createCloudinaryStorage({ ...C.cloudinaryConfigFromEnv(process.env), uploader: (real as any) && v2.uploader, deliveryBase: fake.url });
    const u = await viaEnv.put("content", crypto.randomUUID() + ".png", PNG); assert.deepEqual(await viaEnv.read(u), PNG);
    Object.assign(process.env, keep); for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_FOLDER"]) if (!(k in keep)) delete process.env[k];
  });

  // ───────── 本機模式回歸 ─────────
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nande-up-"));
  Object.assign(process.env, { NANDE_DB_MODE: "remote", DATABASE_URL: "postgresql://u:p@localhost/d", NANDE_UPLOADS_DIR: tmp, NEXTAUTH_SECRET: "x" });
  delete process.env.STORAGE_DRIVER; S.__setCloudinaryStorageForTest(null);
  await t("本機模式（回歸）：put／exists／read／remove(移到 _trash) 行為不變、不會呼叫 Cloudinary", async () => {
    const n = fake.log.length; const ls = S.getStorage(); const u = await ls.put("content", "L1.png", PNG);
    assert.equal(u, "/uploads/content/L1.png"); assert.ok(fs.existsSync(path.join(tmp, "content", "L1.png"))); assert.equal(await ls.exists(u), true); assert.deepEqual(await ls.read(u), PNG);
    await assert.rejects(ls.put("content", "L1.png", JPG)); await ls.remove(u); assert.equal(await ls.exists(u), false); assert.equal(fs.readdirSync(path.join(tmp, "_trash")).length, 1); assert.equal(fake.log.length, n);
  });

  // ───────── /api/files ─────────
  const { NextRequest } = require(P + "node_modules/next/server");
  const files = await import(P + "app/api/files/[...path]/route");
  const get = (segs: string[]) => files.GET(new NextRequest("http://x/uploads/" + segs.join("/")), { params: { path: segs } });
  const cstore = mk({ folder: "nande-test" });
  const cu = await cstore.put("content", crypto.randomUUID() + ".png", PNG); const cseg = cu.split("/").slice(2);
  fs.mkdirSync(path.join(tmp, "content"), { recursive: true }); fs.writeFileSync(path.join(tmp, "content", "old.jpg"), JPG);
  await t("/uploads（local 模式、沒開 fallback）：本機檔案正常；Cloudinary 上的檔案 404", async () => {
    assert.equal((await get(["content", "old.jpg"])).status, 200); assert.equal((await get(cseg)).status, 404);
  });
  process.env.STORAGE_DRIVER = "cloudinary"; S.__setCloudinaryStorageForTest(cstore);
  await t("/uploads（cloudinary 模式）：舊本機圖片優先、原樣提供；新圖片由 Cloudinary 取得（proxy）並帶正確標頭", async () => {
    const old = await get(["content", "old.jpg"]); assert.equal(old.status, 200); assert.equal(old.headers.get("content-type"), "image/jpeg"); assert.deepEqual(Buffer.from(await old.arrayBuffer()), JPG);
    const r = await get(cseg); assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/png"); assert.equal(r.headers.get("x-content-type-options"), "nosniff"); assert.match(r.headers.get("cache-control")!, /s-maxage/); assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG);
  });
  await t("/uploads（cloudinary 模式）：不存在 404；穿越／_trash／動畫／非圖片 一律 404 且不向 Cloudinary 發請求", async () => {
    assert.equal((await get(["content", "none.png"])).status, 404);
    const n = fake.log.length;
    for (const s of [["content", ".."], ["..", "content", "a.png"], ["_trash", "x.png"], ["content", "a.php"], ["chinese-animation", "a.mp4"], ["content", "%2e%2e"], ["content", "life-comics", ".."], ["content", "_x", "..", "a.png"], ["a", "b", "c", "d", "e", "f", "g.png"]]) assert.equal((await get(s)).status, 404, JSON.stringify(s));
    assert.equal(fake.log.length, n);
  });
  await t("/uploads（cloudinary 模式）：Cloudinary 暫時故障回 502（不是假的 404）", async () => {
    fake.failNextDeliveries(1); assert.equal((await get(cseg)).status, 502);
  });
  await t("/uploads：CLOUDINARY_DELIVERY_MODE=redirect → 302 轉到 Secure URL", async () => {
    process.env.CLOUDINARY_DELIVERY_MODE = "redirect"; const r = await get(cseg); delete process.env.CLOUDINARY_DELIVERY_MODE;
    assert.equal(r.status, 302); assert.match(r.headers.get("location")!, /\/image\/upload\/nande-test\/content\/.+\.png$/);
  });
  await t("/uploads（local 模式 + CLOUDINARY_FALLBACK=1）：本機沒有的圖片改由 Cloudinary 提供", async () => {
    process.env.STORAGE_DRIVER = "local"; process.env.CLOUDINARY_FALLBACK = "1"; const r = await get(cseg); delete process.env.CLOUDINARY_FALLBACK; process.env.STORAGE_DRIVER = "cloudinary";
    assert.equal(r.status, 200);
  });

  // ───────── 上傳 API（權限、驗證、大小）─────────
  let auth: any = null; inject("lib/requireAdmin.ts", { requireAdmin: async () => auth });
  let created: any[] = []; inject("lib/prisma.ts", { prisma: { photoSubmission: { create: async ({ data }: any) => { created.push(data); return { id: "p1", ...data }; } } } });
  const form = (type: string, bytes: Buffer, name = "a.png") => { const f = new FormData(); f.set("file", new File([new Uint8Array(bytes)], name, { type })); return f; };
  const up = await import(P + "app/api/admin/upload/route");
  const post = (f: FormData) => up.POST(new NextRequest("http://x/api/admin/upload", { method: "POST", body: f }));
  await t("管理員上傳 API（cloudinary）：未登入 401，Cloudinary 沒有收到任何請求", async () => {
    const n = fake.log.length; assert.equal((await post(form("image/png", PNG))).status, 401); assert.equal(fake.log.length, n);
  });
  await t("管理員上傳 API（cloudinary）：登入後成功 → /uploads/content/<uuid>.png，檔案在 Cloudinary，前台 /uploads 可顯示", async () => {
    auth = { user: { email: "a@b.c" } }; const r = await post(form("image/png", PNG)); assert.equal(r.status, 200); const { url: u } = await r.json();
    assert.match(u, /^\/uploads\/content\/[0-9a-f-]{36}\.png$/); assert.equal(await cstore.exists(u), true);
    const view = await get(u.split("/").slice(2)); assert.equal(view.status, 200); assert.deepEqual(Buffer.from(await view.arrayBuffer()), PNG);
  });
  await t("上傳驗證仍有效：不支援格式（gif／svg／pdf）、超過 10MB 都 400 且不上傳", async () => {
    const n = fake.log.length;
    for (const [ty, b, nm] of [["image/gif", Buffer.from("GIF89a"), "a.gif"], ["image/svg+xml", SVG, "a.svg"], ["application/pdf", Buffer.from("%PDF"), "a.pdf"]] as any) assert.equal((await post(form(ty, b, nm))).status, 400, ty);
    assert.equal((await post(form("image/png", Buffer.alloc(10 * 1024 * 1024 + 1)))).status, 400); assert.equal(fake.log.length, n);
  });
  await t("Cloudinary 設定缺漏時，上傳 API 回 500 的友善訊息（不洩漏內部細節）、不會改存本機", async () => {
    const keep = process.env.STORAGE_DRIVER; S.__setCloudinaryStorageForTest(null);
    for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_URL"]) delete process.env[k];
    const before = fs.readdirSync(path.join(tmp, "content")).length; const r = await post(form("image/png", PNG)); assert.equal(r.status, 500);
    assert.equal(fs.readdirSync(path.join(tmp, "content")).length, before); S.__setCloudinaryStorageForTest(cstore); process.env.STORAGE_DRIVER = keep!;
  });
  await t("公開投稿 /api/uploads（cloudinary）：圖片存到 Cloudinary 的 submissions，建立待審紀錄", async () => {
    const pub = await import(P + "app/api/uploads/route"); const f = form("image/jpeg", JPG, "p.jpg"); f.set("title", "t"); f.set("name", "n");
    const r = await pub.POST(new NextRequest("http://x/api/uploads", { method: "POST", body: f })); const body = await r.json();
    if (r.status !== 200) throw new Error(r.status + JSON.stringify(body));
    assert.equal(created.length, 1); const u = created[0].previewUrl ?? created[0].imageUrl ?? JSON.stringify(created[0]); assert.match(String(u), /\/uploads\/submissions\/[0-9a-f-]{36}\.jpg/);
  });

  // ───────── 多層子資料夾／同名不同副檔名／中文與特殊符號檔名 ─────────
  const PNG2 = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"), Buffer.alloc(40, 7)]);
  const JPG2 = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(40, 9)]);
  await t("parseUploadUrl：多層路徑（content/life-comics/…）與 public_id 規則；兩層 UUID 檔名的 public_id 與舊版完全相同", () => {
    const u = crypto.randomUUID();
    const a = C.parseUploadUrl("/uploads/content/life-comics/life-1-en.png");
    assert.deepEqual(a, { subdir: "content/life-comics", filename: "life-1-en.png", base: "life-1-en", ext: ".png", idDir: "content/life-comics", idBase: "life-1-en__png", hashed: false });
    assert.equal(C.publicIdFor("nande-platform", a), "nande-platform/content/life-comics/life-1-en__png");
    const b = C.parseUploadUrl(`/uploads/content/${u}.jpg`); assert.equal(C.publicIdFor("nande-platform", b), `nande-platform/content/${u}`); // 與舊版相同
    assert.notEqual(C.publicIdFor("f", C.parseUploadUrl("/uploads/content/a.png")), C.publicIdFor("f", C.parseUploadUrl("/uploads/content/a.jpg")), "同名不同副檔名必須是不同 public_id");
    assert.notEqual(C.publicIdFor("f", C.parseUploadUrl("/uploads/content/a.jpg")), C.publicIdFor("f", C.parseUploadUrl("/uploads/content/a.jpeg")));
    const z = C.parseUploadUrl("/uploads/content/" + encodeURIComponent("921防災日 (2).final.png")); assert.equal(z.hashed, true); assert.match(z.idBase, /^h-[0-9a-f]{20}__png$/);
    assert.equal(C.parseUploadUrl("/uploads/content/" + encodeURIComponent("921防災日 (2).final.png")).idBase, z.idBase, "同一個網址每次算出的 public_id 必須相同");
    const d = C.parseUploadUrl("/uploads/" + encodeURIComponent("中文資料夾") + "/a.png"); assert.match(d.idDir, /^h-[0-9a-f]{20}$/); assert.equal(d.subdir, "中文資料夾");
  });
  await t("多層路徑：上傳／存在／讀取／傳遞網址；public_id＝folder/content/life-comics/life-1-zh__png", async () => {
    const u = await st.put("content/life-comics", "life-1-zh.png", PNG);
    assert.equal(u, "/uploads/content/life-comics/life-1-zh.png"); assert.ok(fake.assets.has("image/nande-test/content/life-comics/life-1-zh__png"));
    assert.equal(await st.exists(u), true); assert.deepEqual(await st.read(u), PNG);
    assert.equal(st.deliveryUrl(u).endsWith("/image/upload/nande-test/content/life-comics/life-1-zh__png.png"), true);
    await assert.rejects(st.put("content/life-comics", "life-1-zh.png", PNG2), /已存在/); assert.deepEqual(await st.read(u), PNG);
  });
  await t("同名不同副檔名（life-2-en.png／life-2-en.jpg）：各自獨立的檔案，不互相覆蓋，各自讀回自己的內容", async () => {
    const a = await st.put("content/life-comics", "life-2-en.png", PNG), b = await st.put("content/life-comics", "life-2-en.jpg", JPG);
    assert.deepEqual(await st.read(a), PNG); assert.deepEqual(await st.read(b), JPG);
    assert.ok(fake.assets.has("image/nande-test/content/life-comics/life-2-en__png") && fake.assets.has("image/nande-test/content/life-comics/life-2-en__jpg"));
    assert.equal(await st.exists("/uploads/content/life-comics/life-2-en.jpeg"), false, "沒上傳過的 .jpeg 不能被當成已存在");
  });
  await t("中文／空白／點／括號等特殊符號檔名：可上傳、可讀、不衝突；網址（資料庫內容）原樣保留", async () => {
    const names = ["921防災日.png", "生活 1 (final).png", "a.b.c.png", "ＡＢ－１.png", "x&y=z.png"];
    for (const [i, n] of names.entries()) {
      const u = await st.put("content", n, i % 2 ? PNG : PNG2); assert.equal(u, "/uploads/content/" + n);
      const enc = "/uploads/content/" + encodeURIComponent(n);
      assert.equal(await st.exists(enc), true, n); assert.deepEqual(await st.read(enc), i % 2 ? PNG : PNG2, n);
    }
    assert.equal(new Set([...fake.assets.keys()].filter((k) => k.includes("/h-"))).size >= names.length, true);
    const dir = await st.put("中文 資料夾", "圖片.png", PNG); assert.deepEqual(await st.read("/uploads/" + encodeURIComponent("中文 資料夾") + "/" + encodeURIComponent("圖片.png")), PNG); assert.equal(dir, "/uploads/中文 資料夾/圖片.png");
  });
  await t("上傳驗證：會讓網址被截斷或改寫的字元（? # %）與路徑穿越仍被拒絕", async () => {
    const n = fake.log.length;
    for (const [d, f] of [["content", "a?b.png"], ["content", "a#b.png"], ["content", "a%2fb.png"], ["content", "a/b.png"], ["content/../x", "a.png"], ["content/_x/..", "a.png"], ["_trash/x", "a.png"]]) await assert.rejects(st.put(d!, f!, PNG), /不合法/, d + "/" + f);
    assert.equal(fake.log.length, n);
  });
  await t("刪除多層路徑的檔案：移到 _trash（不永久刪除），其他同資料夾檔案不受影響", async () => {
    const u = "/uploads/content/life-comics/life-2-en.png"; await st.remove(u);
    assert.equal(await st.exists(u), false); assert.equal(await st.exists("/uploads/content/life-comics/life-2-en.jpg"), true);
    assert.ok([...fake.assets.keys()].some((k) => k.includes("nande-test/_trash/") && k.includes("content-life-comics__life-2-en__png")));
  });
  await t("/uploads（多層）：本機有→本機優先；本機沒有→由 Cloudinary 取得；內容與類型正確", async () => {
    fs.mkdirSync(path.join(tmp, "content", "life-comics"), { recursive: true }); fs.writeFileSync(path.join(tmp, "content", "life-comics", "local-only.png"), PNG2);
    const l = await get(["content", "life-comics", "local-only.png"]); assert.equal(l.status, 200); assert.deepEqual(Buffer.from(await l.arrayBuffer()), PNG2);
    const c = await get(["content", "life-comics", "life-1-zh.png"]); assert.equal(c.status, 200); assert.equal(c.headers.get("content-type"), "image/png"); assert.deepEqual(Buffer.from(await c.arrayBuffer()), PNG);
    const j = await get(["content", "life-comics", "life-2-en.jpg"]); assert.equal(j.status, 200); assert.equal(j.headers.get("content-type"), "image/jpeg"); assert.deepEqual(Buffer.from(await j.arrayBuffer()), JPG);
    assert.equal((await get(["content", "life-comics", "none.png"])).status, 404);
  });
  await t("/uploads：中文檔名（網址編碼）本機與 Cloudinary 都能提供", async () => {
    fs.writeFileSync(path.join(tmp, "content", "本機中文.png"), PNG2);
    const l = await get(["content", encodeURIComponent("本機中文.png")]); assert.equal(l.status, 200); assert.deepEqual(Buffer.from(await l.arrayBuffer()), PNG2);
    const c = await get(["content", encodeURIComponent("921防災日.png")]); assert.equal(c.status, 200); assert.equal(c.headers.get("content-type"), "image/png");
    const sp = await get(["content", encodeURIComponent("生活 1 (final).png")]); assert.equal(sp.status, 200);
  });

  // ───────── 動畫：後台上傳／前台串流都走 storage ─────────
  await t("答題成功動畫檔（MP4）：經 storage 讀取，前台串流路由支援 Range（206）", async () => {
    const mu = await cstore.put("chinese-animation", crypto.randomUUID() + ".mp4", MP4);
    inject("lib/chinese/correctAnimationDb.ts", { validStageId: () => true, getStageAnimation: async () => ({ fileUrl: mu, format: "mp4" }) });
    const route = await import(P + "app/api/chinese/correct-animation/file/route");
    const mkReq = (range?: string) => new NextRequest("http://x/api/chinese/correct-animation/file?stageId=s1", { headers: range ? { range } : {} });
    const full = await route.GET(mkReq()); assert.equal(full.status, 200); assert.equal(full.headers.get("content-type"), "video/mp4"); assert.equal(Buffer.from(await full.arrayBuffer()).length, MP4.length);
    const part = await route.GET(mkReq("bytes=0-9")); assert.equal(part.status, 206); assert.equal(part.headers.get("content-range"), `bytes 0-9/${MP4.length}`);
  });

  await fake.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} 項通過，${fail} 項失敗`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
