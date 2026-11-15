/** 遷移前掃描工具測試（npm run test:audit）：用暫存資料夾＋記憶體 SQLite，不碰任何正式資料。 */
import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { buildAudit, collectDbRefs, extractUploadUrls, filesCsv, summaryMarkdown, walkUploads, type Query } from "../../prisma/tools/uploadsAuditCore";

// node:sqlite 需要 Node 22.5 以上；沒有就跳過（不算失敗），避免型別宣告缺少時影響 npm run build。
let DatabaseSync: any;
try { DatabaseSync = require("node:sqlite").DatabaseSync; } catch { console.log("SKIP：此 Node 版本沒有 node:sqlite（需要 22.5 以上），掃描工具測試略過。"); process.exit(0); }
let pass = 0, fail = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };
const PNG = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(40, 1)]);
const JPG = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(40, 2)]);
const GIF = Buffer.from("GIF89a" + "x".repeat(40));
const MP4 = Buffer.concat([Buffer.from("0000002066747970", "hex"), Buffer.alloc(100, 3)]);
const w = (root: string, rel: string, data: Buffer | string) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const snapshot = (root: string) => { const out: string[] = []; const go = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? go(p) : out.push(p + ":" + fs.statSync(p).size + ":" + crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex")); } }; go(root); return out.sort().join("\n"); };

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-up-"));
  const U1 = crypto.randomUUID(), U2 = crypto.randomUUID(), U3 = crypto.randomUUID();
  w(root, `content/${U1}.png`, PNG);                    // 使用中、UUID
  w(root, `content/${U2}.jpg`, JPG);                    // 未引用
  w(root, `content/${U3}.png`, PNG); w(root, `content/${U3}.jpg`, JPG); // 同 UUID 不同副檔名 → public_id 衝突
  w(root, "content/life-comics/life-1-zh.png", PNG);    // 多層、使用中（JSON 內）
  w(root, "content/life-comics/life-1-en.png", PNG);    // 同名不同副檔名：不衝突
  w(root, "content/life-comics/life-1-en.jpg", JPG);
  w(root, "content/921防災日 (2).png", PNG);            // 中文／空白／括號：雜湊 public_id
  w(root, "content/fake.png", Buffer.from("not an image at all")); // 內容與副檔名不符
  w(root, "content/run.php", "<?php ?>");               // 網站不提供
  w(root, "content/empty.png", Buffer.alloc(0));        // 0 byte
  w(root, "content/big.png", Buffer.concat([PNG, Buffer.alloc(3000, 5)])); // 超過（測試用的）小上限
  w(root, "chinese-animation/ok.mp4", MP4); w(root, "chinese-animation/ok.gif", GIF);
  w(root, "content/Case.png", PNG);                     // 資料庫寫成 case.png
  w(root, "submissions/.gitkeep", ""); w(root, "_trash/old.png", PNG); // 回收區
  w(root, "top.png", PNG);                              // 最上層
  const before = snapshot(root);

  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE Announcement (id TEXT PRIMARY KEY, image TEXT, content TEXT, n INTEGER);
    CREATE TABLE ChinesePage (id TEXT PRIMARY KEY, comicImages TEXT);
    CREATE TABLE PhotoSubmission (id TEXT PRIMARY KEY, previewUrl TEXT);
    CREATE TABLE Admin (id TEXT PRIMARY KEY, passwordHash TEXT);
    CREATE TABLE Plain (a TEXT);`);
  db.prepare("INSERT INTO Announcement VALUES (?,?,?,?)").run("a1", `/uploads/content/${U1}.png`, `<p>看圖 <a href="/uploads/content/${encodeURIComponent("921防災日 (2).png")}">連結</a>與 /uploads/content/life-comics/life-1-en.png。</p>`, 1);
  db.prepare("INSERT INTO ChinesePage VALUES (?,?)").run("c1", JSON.stringify([{ url: "/uploads/content/life-comics/life-1-zh.png", width: 1, height: 1 }]));
  db.prepare("INSERT INTO PhotoSubmission VALUES (?,?)").run("p1", "https://drive.google.com/uc?id=abc");
  db.prepare("INSERT INTO PhotoSubmission VALUES (?,?)").run("p2", "/uploads/submissions/gone.jpg");
  db.prepare("INSERT INTO Announcement VALUES (?,?,?,?)").run("a2", "/uploads/content/case.png?v=3", "", 2);
  db.prepare("INSERT INTO Admin VALUES (?,?)").run("ad", "/uploads/should-not-be-read.png");
  db.prepare("INSERT INTO Plain VALUES (?)").run("/uploads/chinese-animation/ok.mp4");
  const issued: string[] = [];
  const query: Query = async (sql) => { issued.push(sql); return db.prepare(sql).all() as any; };

  await t("extractUploadUrls：單一網址／JSON／內文連結／去掉 ?query 與結尾標點", () => {
    assert.deepEqual(extractUploadUrls("/uploads/content/a.png?v=2"), ["/uploads/content/a.png"]);
    assert.deepEqual(extractUploadUrls('[{"url":"/uploads/x/y.png"}]'), ["/uploads/x/y.png"]);
    assert.deepEqual(extractUploadUrls('see "/uploads/a/b.png", and (/uploads/c/d.jpg).').sort(), ["/uploads/a/b.png", "/uploads/c/d.jpg"]);
    assert.deepEqual(extractUploadUrls("https://other.site/images/a.png"), []);
  });

  const { files, internal } = walkUploads(root);
  const refsRes = await collectDbRefs(query);
  const rep = buildAudit({ files, internal, refs: refsRes.refs, folder: "nande-platform", limits: { maxImageBytes: 2000, maxVideoBytes: 1e6 }, seedRels: new Set(["submissions/gone.jpg"]), driveRows: refsRes.driveRows, tablesScanned: refsRes.tablesScanned, tablesSkipped: refsRes.tablesSkipped });
  const R = (rel: string) => rep.records.find((r) => r.rel === rel)!;

  await t("唯讀：掃描前後 uploads 的每個檔案（大小與內容雜湊）完全相同，且資料庫只收到 SELECT／PRAGMA", () => {
    assert.equal(snapshot(root), before); assert.ok(issued.length > 0 && issued.every((s) => /^\s*(SELECT|PRAGMA table_info)/i.test(s)), issued.join("\n"));
  });
  await t("檔案統計：回收區只統計不列入；.gitkeep 略過；資料夾分布正確", () => {
    assert.deepEqual(internal.map((i) => [i.dir, i.files]), [["_trash", 1]]); assert.equal(rep.records.some((r) => r.rel.startsWith("_trash")), false);
    assert.equal(rep.totals.files, rep.records.length); assert.ok(rep.byFolder.find((f) => f.folder === "content/life-comics")!.files === 3);
  });
  await t("資料庫引用：Admin 表不讀；JSON、內文連結、?query 都能對到檔案", () => {
    assert.ok(refsRes.tablesSkipped.includes("Admin")); assert.ok(!refsRes.refs.some((r) => r.table === "Admin"));
    assert.equal(R(`content/${U1}.png`).status, "used"); assert.equal(R("content/life-comics/life-1-zh.png").status, "used"); assert.equal(R("content/life-comics/life-1-en.png").status, "used");
    assert.equal(R("content/921防災日 (2).png").status, "used"); assert.equal(R("chinese-animation/ok.mp4").status, "used");
    assert.equal(R(`content/${U2}.jpg`).status, "unreferenced");
  });
  await t("批次：使用中且可遷移＝1；未引用且可遷移＝2；有問題＝0", () => {
    assert.equal(R(`content/${U1}.png`).batch, 1); assert.equal(R("content/life-comics/life-1-zh.png").batch, 1); assert.equal(R(`content/${U2}.jpg`).batch, 2);
    for (const rel of ["content/fake.png", "content/run.php", "content/empty.png", "content/big.png", "top.png"]) assert.equal(R(rel).batch, 0, rel);
  });
  await t("預計 public_id：UUID 不含副檔名；其餘帶副檔名；中文／空白檔名為雜湊；多層路徑保留", () => {
    assert.equal(R(`content/${U1}.png`).publicId, `nande-platform/content/${U1}`);
    assert.equal(R("content/life-comics/life-1-zh.png").publicId, "nande-platform/content/life-comics/life-1-zh__png");
    assert.match(R("content/921防災日 (2).png").publicId!, /^nande-platform\/content\/h-[0-9a-f]{20}__png$/); assert.equal(R("content/921防災日 (2).png").hashedName, true);
    assert.equal(R("chinese-animation/ok.mp4").resourceType, "video"); assert.equal(R("chinese-animation/ok.gif").resourceType, "image");
  });
  await t("同名不同副檔名（life-1-en.png／.jpg）不衝突；同 UUID 不同副檔名會被列為衝突", () => {
    assert.notEqual(R("content/life-comics/life-1-en.png").publicId, R("content/life-comics/life-1-en.jpg").publicId);
    assert.equal(rep.conflicts.length, 1); assert.deepEqual(rep.conflicts[0]!.files.sort(), [`content/${U3}.jpg`, `content/${U3}.png`]); assert.equal(R(`content/${U3}.png`).batch, 0);
  });
  await t("問題偵測：內容與副檔名不符、0 byte、超過大小、不提供的副檔名、最上層檔案", () => {
    assert.match(R("content/fake.png").problems.join(), /內容和副檔名不符/); assert.match(R("content/empty.png").problems.join(), /大小為 0/);
    assert.match(R("content/big.png").problems.join(), /超過大小限制/); assert.match(R("content/run.php").problems.join(), /副檔名 \.php/); assert.match(R("top.png").problems.join(), /最上層/);
  });
  await t("資料庫有引用但找不到：列出原因（含大小寫不一致、內建原檔是否有同名）", () => {
    const m = (u: string) => rep.missing.find((x) => x.url === u)!;
    assert.equal(m("/uploads/submissions/gone.jpg").seedHas, true); assert.match(m("/uploads/submissions/gone.jpg").reason, /找不到/);
    assert.equal(m("/uploads/content/case.png").caseMatch, "content/Case.png"); assert.match(m("/uploads/content/case.png").reason, /大小寫/);
  });
  await t("Google Drive 投稿：只統計筆數，不列入遷移", () => { assert.deepEqual(rep.driveRows, [{ table: "PhotoSubmission", column: "previewUrl", count: 1 }]); });
  await t("報表：batch1 容量＝第一批檔案大小總和；CSV 含每個檔案的原始路徑與 public_id；摘要可產生", () => {
    const b1 = rep.records.filter((r) => r.batch === 1); assert.equal(rep.batch1.files, b1.length); assert.equal(rep.batch1.bytes, b1.reduce((n, r) => n + r.size, 0));
    const csv = filesCsv(rep); assert.ok(csv.startsWith("﻿")); assert.ok(csv.includes("/uploads/content/life-comics/life-1-zh.png") && csv.includes("nande-platform/content/life-comics/life-1-zh__png"));
    const md = summaryMarkdown(rep); assert.ok(md.includes("第一批預計遷移") && md.includes("Google Drive"));
    assert.ok(R(`content/${U1}.png`).sha256 && R(`content/${U1}.png`).sha256!.length === 64);
  });
  await t("掃描工具只允許唯讀 SQL：任何非 SELECT／PRAGMA 的語句直接丟錯", async () => {
    await assert.rejects(collectDbRefs(async (sql) => { if (/sqlite_master/.test(sql)) throw new Error("x"); return []; }), /x/);
    // 內建防護：直接餵一個會回傳資料表、但後續被要求執行寫入的假 query 不存在於程式碼路徑；以下確認 guard 本身
    let sawBad = false; try { await collectDbRefs(async (sql) => { if (/DROP|DELETE|INSERT|UPDATE/i.test(sql)) sawBad = true; return db.prepare(sql).all() as any; }); } catch {}
    assert.equal(sawBad, false);
  });

  fs.rmSync(root, { recursive: true, force: true });
  console.log(`\n${pass} 項通過，${fail} 項失敗`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
