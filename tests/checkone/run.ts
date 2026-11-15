/** 單一檔案三方檢查核心測試（npm run test:checkone）：用暫存資料夾與假的 Cloudinary 回應，不連網路。 */
import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { checkOne, renderCheckOne, sha256Stream } from "../../prisma/tools/uploadsCheckOneCore";
import type { LedgerEntry } from "../../prisma/tools/uploadsMigrateCore";

let pass = 0, fail = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };
const root = fs.mkdtempSync(path.join(os.tmpdir(), "checkone-"));
const UUID = crypto.randomUUID(); const url = `/uploads/chinese-animation/${UUID}.mp4`; const data = Buffer.concat([Buffer.from("0000002066747970", "hex"), crypto.randomBytes(5000)]);
fs.mkdirSync(path.join(root, "chinese-animation")); fs.writeFileSync(path.join(root, "chinese-animation", `${UUID}.mp4`), data);
const sha = crypto.createHash("sha256").update(data).digest("hex");
const ev = (event: LedgerEntry["event"], u = url, error?: string): LedgerEntry => ({ ts: "2026-11-15T01:00:00Z", runId: "run-1", event, url: u, publicId: "nande-platform/chinese-animation/" + UUID, sha256: sha, size: data.length, error });
const info = (over: any = {}) => ({ publicId: "nande-platform/chinese-animation/" + UUID, bytes: data.length, format: "mp4", version: 5, secureUrl: "https://res.cloudinary.com/x/video/upload/v5/a.mp4", ...over });
const base = (over: any = {}) => ({ url, uploadsDir: root, ledger: [] as LedgerEntry[], inspect: async () => info() as any, download: async () => ({ sha256: sha, bytes: data.length }), ...over });
const before = () => fs.readFileSync(path.join(root, "chinese-animation", `${UUID}.mp4`)).toString("hex");

(async () => {
  const snap = before();
  await t("本機大小與 SHA-256 正確（串流計算）", async () => { assert.equal(await sha256Stream(path.join(root, "chinese-animation", `${UUID}.mp4`)), sha); });
  await t("三方一致且帳本有 verified → 不需上傳、不需修復", async () => {
    const r = await checkOne(base({ ledger: [ev("uploaded"), ev("verified")] })); assert.equal(r.needsUpload, false); assert.equal(r.needsLedgerRepair, false); assert.equal(r.compare.hashSame, true); assert.equal(r.ledger.verified, true);
  });
  await t("【實際情況】雲端內容正確、帳本只有 uploaded＋verify-failed → 不需重傳，但需要修復驗證紀錄；並列出所有沒有 verified 的檔案", async () => {
    const other = "/uploads/content/other.png";
    const r = await checkOne(base({ ledger: [ev("uploaded"), ev("verify-failed", url, "下載驗證失敗：timeout"), ev("verified", other)] }));
    assert.equal(r.needsUpload, false); assert.equal(r.needsLedgerRepair, true); assert.equal(r.ledger.verifiedTotal, 1); assert.deepEqual(r.ledger.urlsWithoutVerified, [url]);
    assert.match(r.conclusions.join(), /沒有 verified/); assert.match(renderCheckOne(r), /不需要/);
  });
  await t("雲端不存在、本機存在且與掃描報告一致 → 需要補傳", async () => {
    const r = await checkOne(base({ inspect: async () => null, auditRecord: { sha256: sha, size: data.length, batch: 1, status: "used", publicId: "p" } })); assert.equal(r.needsUpload, true); assert.equal(r.cloud.exists, false); assert.equal(r.compare.downloaded, undefined);
  });
  await t("雲端存在但內容不同 → 不建議重傳（不覆蓋）、不修復帳本", async () => {
    const r = await checkOne(base({ download: async () => ({ sha256: "0".repeat(64), bytes: data.length }), ledger: [ev("uploaded")] })); assert.equal(r.compare.hashSame, false); assert.equal(r.needsUpload, false); assert.equal(r.needsLedgerRepair, false); assert.match(r.conclusions.join(), /不覆蓋/);
  });
  await t("雲端大小不同 → 明確指出", async () => { const r = await checkOne(base({ inspect: async () => info({ bytes: 1 }) as any })); assert.equal(r.compare.cloudSizeSame, false); assert.match(r.conclusions.join(), /大小/); });
  await t("下載失敗 → 如實回報失敗，不當成一致", async () => {
    const r = await checkOne(base({ download: async () => { throw new Error("timeout"); } })); assert.equal(r.compare.hashSame, null); assert.match(r.compare.downloadError!, /timeout/); assert.equal(r.needsLedgerRepair, false);
  });
  await t("本機找不到檔案 → 不需上傳（沒有來源）並明確說明；本機與掃描報告不同時警告", async () => {
    const miss = await checkOne(base({ url: `/uploads/chinese-animation/${crypto.randomUUID()}.mp4`, inspect: async () => null })); assert.equal(miss.local.exists, false); assert.equal(miss.needsUpload, false);
    const diff = await checkOne(base({ inspect: async () => null, auditRecord: { sha256: "1".repeat(64), size: 1, batch: 1, status: "used" } })); assert.equal(diff.compare.localVsAuditSame, false); assert.equal(diff.needsUpload, false);
  });
  await t("不合法網址 → 直接拒絕；檢查全程不改動本機檔案", async () => {
    await assert.rejects(checkOne(base({ url: "/uploads/../a.png" })), /不符合網站讀取規則/); assert.equal(before(), snap);
  });
  fs.rmSync(root, { recursive: true, force: true });
  console.log(`\n${pass} 項通過，${fail} 項失敗`); process.exit(fail ? 1 : 0);
})();
