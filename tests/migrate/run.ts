/** 第一批遷移工具測試（npm run test:migrate）：真正的 Cloudinary 驅動＋SDK＋假 Cloudinary 伺服器，不使用任何真實帳號或資料。 */
import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { startFakeCloudinary } from "../cloudinary/fakeCloudinary";
import { buildAudit, walkUploads } from "../../prisma/tools/uploadsAuditCore";
import { appendLedger, loadPlan, readLedger, resultCsv, runApply, runDryRun, sha256Of, summarize, type ApplyDeps, type MigrateStorage } from "../../prisma/tools/uploadsMigrateCore";

const P = path.resolve(__dirname, "../..") + "/";
let pass = 0, fail = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };
const mkPng = (seed: number) => Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"), Buffer.alloc(60, seed)]);
const mkJpg = (seed: number) => Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(60, seed)]);
const w = (root: string, rel: string, data: Buffer) => { const f = path.join(root, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const snapshot = (root: string) => { const out: string[] = []; const go = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? go(p) : out.push(p.slice(root.length) + ":" + sha256Of(fs.readFileSync(p))); } }; go(root); return out.sort().join("\n"); };
const noSleep = async () => {};

(async () => {
  const cloud = "demo-" + crypto.randomBytes(3).toString("hex"), key = String(Math.floor(Math.random() * 1e14)), secret = crypto.randomBytes(14).toString("hex");
  const fake = await startFakeCloudinary({ cloud, key, secret });
  const { v2 } = require(P + "node_modules/cloudinary");
  v2.config({ upload_prefix: fake.url, secure: false });
  const C = await import(P + "lib/storage/cloudinary");
  const mkStorage = () => C.createCloudinaryStorage({ cloudName: cloud, apiKey: key, apiSecret: secret, folder: "nande-test", uploader: v2.uploader, api: v2.api, deliveryBase: fake.url });
  const st: MigrateStorage = mkStorage();
  const uploads = () => fake.log.filter((l) => /^\/v1_1\/[^/]+\/(image|video)\/upload$/.test(l.path)).length;
  const destructive = () => fake.log.filter((l) => /\/(rename|destroy)$/.test(l.path)).length;

  // ── 準備：本機 uploads（含多層、中文檔名、歷史未引用檔）＋掃描報告 ──
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mig-up-"));
  const U1 = crypto.randomUUID(), U2 = crypto.randomUUID(), UH = crypto.randomUUID();
  const used = [`content/${U1}.png`, `submissions/${U2}.jpg`, "content/life-comics/life-1-zh.png", "content/life-comics/life-1-en.png", "content/life-comics/life-1-en.jpg", "content/921防災日 (2).png"];
  used.forEach((rel, i) => w(root, rel, rel.endsWith(".jpg") ? mkJpg(i + 1) : mkPng(i + 1)));
  w(root, `content/${UH}.png`, mkPng(99)); // 歷史、未引用 → batch=2
  const { files, internal } = walkUploads(root);
  const refs = used.map((rel, i) => ({ url: "/uploads/" + rel, table: "T", column: "image", rowId: String(i) }));
  const reportOf = () => JSON.parse(JSON.stringify(buildAudit({ files, internal, refs, folder: "nande-test" })));
  const report = reportOf();
  const before = snapshot(root);
  const opt = { folder: "nande-test", uploadsDir: root };

  await t("清單：只含 batch=1（使用中）；歷史檔案不在清單、列在『不處理』；路徑／public_id／SHA-256 取自報告", () => {
    const plan = loadPlan(report, opt);
    assert.equal(plan.errors.length, 0); assert.equal(plan.items.length, used.length); assert.equal(plan.batch1Total, used.length);
    assert.deepEqual(plan.excluded.batch2Files, [`/uploads/content/${UH}.png`]); assert.ok(!plan.items.some((i) => i.url.includes(UH)));
    for (const it of plan.items) { const r = report.records.find((x: any) => x.url === it.url); assert.equal(it.publicId, r.publicId); assert.equal(it.sha256, r.sha256); }
    assert.equal(plan.items.find((i) => i.url.endsWith("life-1-zh.png"))!.publicId, "nande-test/content/life-comics/life-1-zh__png");
  });
  await t("清單防呆：資料夾與報告不同、--expect-count 不符、報告沒有 SHA-256 都會停止", () => {
    assert.throws(() => loadPlan(report, { ...opt, folder: "other" }), /資料夾/);
    assert.throws(() => loadPlan(report, { ...opt, expectCount: 64 }), /expect-count/);
    const noHash = reportOf(); noHash.records.forEach((r: any) => (r.sha256 = null));
    const p = loadPlan(noHash, opt); assert.equal(p.items.length, 0); assert.equal(p.errors.length, used.length); assert.match(p.errors[0]!.problem, /SHA-256/);
  });
  await t("清單防呆：本機檔案掃描後被改／被刪、報告的 public_id 與程式不一致 → 列為錯誤，不進清單", () => {
    const rep = reportOf(); const rec = (rel: string) => rep.records.find((r: any) => r.rel === rel);
    rec(used[0]!).sha256 = "0".repeat(64); rec(used[1]!).size = 1; rec(used[2]!).publicId = "nande-test/content/life-comics/wrong";
    const gone = plan2(rep, (abs) => { if (abs.endsWith("life-1-en.png")) throw new Error("ENOENT"); return fs.readFileSync(abs); });
    assert.equal(gone.errors.length, 4); assert.equal(gone.items.length, used.length - 4);
    assert.ok(gone.errors.some((e) => /SHA-256 不同/.test(e.problem)) && gone.errors.some((e) => /大小/.test(e.problem)) && gone.errors.some((e) => /不一致/.test(e.problem)) && gone.errors.some((e) => /找不到/.test(e.problem)));
    function plan2(r: any, readLocal: (a: string) => Buffer) { return loadPlan(r, { ...opt, readLocal }); }
  });

  const plan = loadPlan(report, opt);
  await t("dry-run（不連雲端）：不呼叫 Cloudinary、不寫帳本；列出全部將上傳的檔案與容量", async () => {
    const n = fake.log.length; const dry = await runDryRun(plan, { ledger: [] });
    assert.equal(fake.log.length, n); assert.equal(dry.toUpload, used.length); assert.equal(dry.unchecked, used.length); assert.equal(dry.toUploadBytes, plan.items.reduce((a, i) => a + i.size, 0));
    assert.ok(dry.rows.every((r) => r.action === "將上傳（尚未檢查雲端）"));
  });
  await t("dry-run（--check-remote）：只做唯讀查詢（沒有上傳／改名／刪除）；已存在的標為略過", async () => {
    const pre = plan.items[0]!; const p = C.parseUploadUrl(pre.url); await mkStorage().put(p.subdir, p.filename, fs.readFileSync(path.join(root, pre.rel)));
    const up = uploads(); const dry = await runDryRun(plan, { ledger: [], storage: st });
    assert.equal(uploads(), up); assert.equal(destructive(), 0); assert.equal(dry.skipExisting, 1); assert.equal(dry.toUpload, used.length - 1);
    // 還原：把這個先放上去的檔案移除，讓後面的測試從乾淨的雲端開始
    fake.assets.delete(`image/${pre.publicId}`);
  });

  const ledgerFile = path.join(root, "..", "ledger-" + crypto.randomUUID() + ".jsonl");
  const mkDeps = (over: Partial<ApplyDeps> = {}, ledgerPath = ledgerFile): ApplyDeps => ({
    storage: st, readLocal: (rel) => fs.readFileSync(path.join(root, ...rel.split("/"))), ledger: readLedger(ledgerPath), appendLedger: (e) => appendLedger(ledgerPath, e), runId: "run-test", sleep: noSleep, ...over,
  });

  await t("正式上傳：全部上傳、下載驗證 SHA-256 一致、取得 Secure URL；雲端 public_id 與清單完全相同；歷史檔案沒有上傳", async () => {
    const rs = await runApply(plan, mkDeps());
    const s = summarize(rs); assert.equal(s.uploaded, used.length); assert.equal(s.verified, used.length); assert.equal(s.failed + s.mismatch + s.verifyFailed, 0);
    for (const it of plan.items) assert.ok(fake.assets.has(`image/${it.publicId}`), it.publicId);
    assert.ok(![...fake.assets.keys()].some((k) => k.includes(UH)), "歷史圖片不可上傳");
    assert.ok(rs.every((r) => r.secureUrl?.startsWith("https://")));
    const lines = readLedger(ledgerFile); assert.equal(lines.filter((l) => l.event === "uploaded").length, used.length); assert.equal(lines.filter((l) => l.event === "verified").length, used.length);
    assert.match(resultCsv(rs), /nande-test\/content\/life-comics\/life-1-zh__png/);
  });
  await t("唯讀保證：本機檔案完全沒變、沒有任何改名／刪除請求送到 Cloudinary", () => { assert.equal(snapshot(root), before); assert.equal(destructive(), 0); });
  await t("續傳：重跑時帳本顯示全部完成 → 零次上傳、零次雲端請求", async () => {
    const up = uploads(), n = fake.log.length; const rs = await runApply(plan, mkDeps());
    assert.equal(uploads(), up); assert.equal(fake.log.length, n); assert.ok(rs.every((r) => r.action === "skipped-ledger" && r.verify === "verified"));
  });
  await t("沒有帳本但雲端已有：略過、不覆蓋、驗證通過（例如上次帳本遺失）", async () => {
    const up = uploads(); const rs = await runApply(plan, mkDeps({}, ledgerFile + ".new"));
    assert.equal(uploads(), up); assert.ok(rs.every((r) => r.action === "skipped-exists" && r.verify === "verified"));
  });
  await t("雲端已有『內容不同』的同名檔案：不覆蓋、不刪除，驗證標為內容不一致並要求人工處理", async () => {
    const it = plan.items[2]!; const key = `image/${it.publicId}`; const other = mkPng(200); fake.assets.get(key)!.body = other; // 模擬舊檔
    const up = uploads(); const rs = await runApply({ ...plan, items: [it] }, mkDeps({}, ledgerFile + ".mismatch"));
    assert.equal(rs[0]!.action, "skipped-exists"); assert.equal(rs[0]!.verify, "hash-mismatch"); assert.match(rs[0]!.error!, /沒有覆蓋/);
    assert.equal(uploads(), up); assert.deepEqual(fake.assets.get(key)!.body, other, "雲端既有內容不可被改動");
    fake.assets.get(key)!.body = fs.readFileSync(path.join(root, it.rel)); // 還原給後面的測試
  });

  // ── 中斷續傳：模擬某一筆持續失敗，再修好後重跑 ──
  const fresh = () => { for (const k of [...fake.assets.keys()]) fake.assets.delete(k); };
  await t("中斷續傳：第 3 筆失敗後重跑，只補傳剩下的，已完成的不重複上傳；帳本最後一行不完整也能讀", async () => {
    fresh(); const lp = ledgerFile + ".resume"; const bad = plan.items[2]!.url;
    let broken = true;
    const flaky: MigrateStorage = { inspect: (u) => st.inspect(u), read: (u) => st.read(u), put: (d, f, b) => (broken && `/uploads/${d}/${f}` === bad ? Promise.reject(new Error("network down")) : st.put(d, f, b)) };
    const r1 = await runApply(plan, mkDeps({ storage: flaky, maxAttempts: 1, abortAfterFailures: 99 }, lp));
    assert.equal(summarize(r1).failed, 1); assert.equal(summarize(r1).uploaded, used.length - 1);
    fs.appendFileSync(lp, '{"ts":"2026-01-01","event":"upl'); // 中斷時殘留的半行
    broken = false; const up = uploads(); const r2 = await runApply(plan, mkDeps({ storage: flaky }, lp));
    assert.equal(uploads() - up, 1, "只補上傳失敗的那一筆"); assert.equal(r2.filter((r) => r.action === "skipped-ledger").length, used.length - 1); assert.equal(summarize(r2).verified, used.length);
    for (const it of plan.items) assert.equal([...fake.assets.keys()].filter((k) => k === `image/${it.publicId}`).length, 1);
  });
  await t("暫時性錯誤自動重試：第一次上傳失敗、第二次成功", async () => {
    fresh(); let first = true;
    const wrap: MigrateStorage = { inspect: (u) => st.inspect(u), read: (u) => st.read(u), put: (d, f, b) => (first ? ((first = false), Promise.reject(new Error("ECONNRESET"))) : st.put(d, f, b)) };
    const rs = await runApply({ ...plan, items: [plan.items[0]!] }, mkDeps({ storage: wrap }, ledgerFile + ".retry"));
    assert.equal(rs[0]!.action, "uploaded"); assert.equal(rs[0]!.verify, "verified");
  });
  await t("連續失敗自動停止：金鑰錯誤時不會對每一筆都打 API，剩下的標為未執行", async () => {
    fresh(); const dead: MigrateStorage = { inspect: () => Promise.reject(new Error("Invalid credentials")), read: st.read, put: st.put };
    const rs = await runApply(plan, mkDeps({ storage: dead, maxAttempts: 1 }, ledgerFile + ".dead"));
    const s = summarize(rs); assert.equal(s.failed, 3); assert.equal(s.notAttempted, used.length - 3); assert.equal(uploads() >= 0, true);
  });
  await t("上傳前再確認本機檔案：掃描後被改的檔案不會被上傳", async () => {
    fresh(); const it = plan.items[0]!; const up = uploads();
    const rs = await runApply({ ...plan, items: [it] }, mkDeps({ readLocal: () => mkPng(77) }, ledgerFile + ".changed"));
    assert.equal(rs[0]!.action, "failed"); assert.match(rs[0]!.error!, /被修改/); assert.equal(uploads(), up);
  });
  await t("驗證會抓到內容不符：下載回來的位元組被改動 → hash-mismatch（不當成成功）", async () => {
    fresh(); const corrupt: MigrateStorage = { inspect: st.inspect, put: st.put, read: async (u) => { const b = await st.read(u); return b ? Buffer.concat([b.subarray(0, b.length - 1), Buffer.from([0])]) : b; } };
    const rs = await runApply({ ...plan, items: [plan.items[0]!] }, mkDeps({ storage: corrupt }, ledgerFile + ".corrupt"));
    assert.equal(rs[0]!.verify, "hash-mismatch"); assert.equal(readLedger(ledgerFile + ".corrupt").some((e) => e.event === "verified"), false);
  });
  await t("清單有未解決的問題時，runApply 直接拒絕（不會上傳任何東西）", async () => {
    const up = uploads(); await assert.rejects(runApply({ ...plan, errors: [{ url: "/uploads/x.png", problem: "x" }] }, mkDeps()), /拒絕上傳/); assert.equal(uploads(), up);
  });
  await t("全程沒有刪除：本機檔案不變、Cloudinary 沒有任何改名／刪除請求", () => { assert.equal(snapshot(root), before); assert.equal(destructive(), 0); });

  // ───────── 命令列流程（實際啟動 uploadsMigrate.ts）：預演不需要確認參數，正式上傳才需要 ─────────
  const { execFile } = require("child_process") as typeof import("child_process");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mig-cli-")) + "/data";
  fs.mkdirSync(path.join(dataDir, "uploads", "content"), { recursive: true }); fs.writeFileSync(path.join(dataDir, "dev.db"), "x");
  const CU = crypto.randomUUID(), CH = crypto.randomUUID();
  w(path.join(dataDir, "uploads"), `content/${CU}.png`, mkPng(5)); w(path.join(dataDir, "uploads"), `content/${CH}.png`, mkPng(6));
  const cw = walkUploads(path.join(dataDir, "uploads"));
  const cliReport = buildAudit({ files: cw.files, internal: cw.internal, refs: [{ url: `/uploads/content/${CU}.png`, table: "T", column: "c", rowId: "1" }], folder: "nande-test" });
  const auditDir = path.join(dataDir, "reports", "uploads-audit-20260101-000000"); fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(path.join(auditDir, "files.json"), JSON.stringify(cliReport)); const auditBefore = fs.readFileSync(path.join(auditDir, "files.json"), "utf8");
  const uploadsBefore = snapshot(path.join(dataDir, "uploads"));
  const cli = (args: string[], withCloud = true) => new Promise<{ code: number; out: string }>((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, NANDE_DATA_DIR: dataDir, CLOUDINARY_FOLDER: "nande-test", NODE_TLS_REJECT_UNAUTHORIZED: "0" };
    for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_URL", "NANDE_UPLOADS_DIR"]) delete env[k];
    if (withCloud) env.CLOUDINARY_URL = `cloudinary://${key}:${secret}@${cloud}?upload_prefix=${encodeURIComponent(fake.url)}`;
    execFile(P + "node_modules/.bin/tsx", [P + "prisma/tools/uploadsMigrate.ts", ...args], { cwd: P, env, timeout: 90000 }, (err, stdout, stderr) => resolve({ code: err ? ((err as any).code ?? 1) : 0, out: stdout + stderr }));
  });
  const migDir = path.join(dataDir, "reports", "uploads-migrate");
  const runDirs = (prefix: string) => (fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((d) => d.startsWith(prefix)) : []);
  await t("CLI 一般預演：不需要 --confirm／--expect-count；產生 dry-run.csv／dry-run.json／summary.md；不連 Cloudinary、不上傳", async () => {
    const n = fake.log.length; const r = await cli(["--limit", "10"], false);
    assert.equal(r.code, 0, r.out); const d = runDirs("dry-run-"); assert.equal(d.length, 1);
    for (const f of ["dry-run.csv", "dry-run.json", "summary.md"]) assert.ok(fs.existsSync(path.join(migDir, d[0]!, f)), f);
    assert.match(r.out, /預計上傳 1 個/); assert.equal(fake.log.length, n); assert.ok(!/需要同時加上/.test(r.out));
  });
  await t("CLI --check-remote：不需要確認參數；連線 Cloudinary 只做唯讀查詢；產生完整預演報告", async () => {
    const n = fake.log.length, up = uploads(); const r = await cli(["--check-remote"]);
    assert.equal(r.code, 0, r.out); assert.ok(fake.log.length > n, "必須真的查詢 Cloudinary"); assert.equal(uploads(), up); assert.equal(destructive(), 0);
    const d = runDirs("dry-run-").sort(); assert.equal(d.length, 2); const last = d[d.length - 1]!;
    for (const f of ["dry-run.csv", "dry-run.json", "summary.md"]) assert.ok(fs.existsSync(path.join(migDir, last, f)), f);
    assert.match(fs.readFileSync(path.join(migDir, last, "dry-run.csv"), "utf8"), /將上傳/); assert.match(fs.readFileSync(path.join(migDir, last, "summary.md"), "utf8"), /唯讀的存在檢查/);
  });
  await t("CLI --apply 缺少 --confirm／--expect-count 或數量不符：拒絕、不上傳、不建立帳本與執行資料夾", async () => {
    const up = uploads();
    for (const args of [["--apply"], ["--apply", "--confirm"], ["--apply", "--expect-count", "1"], ["--apply", "--confirm", "--expect-count", "2"]]) {
      const r = await cli(args); assert.notEqual(r.code, 0, args.join(" ") + "\n" + r.out);
    }
    assert.equal(uploads(), up); assert.equal(runDirs("run-").length, 0); assert.equal(fs.existsSync(path.join(migDir, "ledger.jsonl")), false);
  });
  await t("CLI --apply --confirm --expect-count 正確：通過確認關卡（用 --limit 0 不上傳任何檔案）", async () => {
    const up = uploads(); const r = await cli(["--apply", "--confirm", "--expect-count", "1", "--limit", "0"]);
    assert.equal(r.code, 0, r.out); assert.equal(runDirs("run-").length, 1); assert.equal(uploads(), up);
  });
  await t("CLI 全程：掃描報告與本機 uploads 沒有被改動；沒有刪除／改名請求", () => {
    assert.equal(fs.readFileSync(path.join(auditDir, "files.json"), "utf8"), auditBefore); assert.equal(snapshot(path.join(dataDir, "uploads")), uploadsBefore); assert.equal(destructive(), 0);
  });

  await fake.close(); fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(path.dirname(dataDir), { recursive: true, force: true });
  for (const f of fs.readdirSync(path.join(root, "..")).filter((f) => f.startsWith("ledger-"))) fs.rmSync(path.join(root, "..", f), { force: true });
  console.log(`\n${pass} 項通過，${fail} 項失敗`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
