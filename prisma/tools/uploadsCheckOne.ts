/**
 * npm run check:upload-one -- --url /uploads/chinese-animation/<uuid>.mp4
 * 單一檔案的本機／搬移帳本／Cloudinary 三方【唯讀】檢查。不上傳、不刪除、不移動、不修改任何檔案，不寫帳本與資料庫。
 * 雲端檔案會下載到系統暫存資料夾做 SHA-256 比對，完成後（含失敗時）一定清除。
 * 金鑰只從環境變數／.env.local 讀取，不顯示。
 * 參數：--data-dir <固定資料資料夾>（預設用 NANDE_DATA_DIR／家目錄設定）  --ledger <ledger.jsonl>  --json
 */
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { readConfigFile } from "../../lib/config/dataConfig";
import { readLedger } from "./uploadsMigrateCore";
import { checkOne, renderCheckOne, type RunRecord } from "./uploadsCheckOneCore";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
function loadEnvLocal() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(#.*)?$/.exec(line);
      if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!;
    }
  }
}

async function main() {
  loadEnvLocal();
  const url = arg("--url");
  if (!url) { console.error("❌ 請加上 --url /uploads/…"); process.exit(1); }
  const dataDir = path.resolve((arg("--data-dir") ?? process.env.NANDE_DATA_DIR ?? readConfigFile()?.dataDir ?? "").replace(/^["']|["']$/g, ""));
  if (!arg("--data-dir") && !process.env.NANDE_DATA_DIR && !readConfigFile()?.dataDir) { console.error("❌ 找不到固定資料資料夾：請加上 --data-dir \"C:\\路徑\\南得遇見你資料\"。"); process.exit(1); }
  const uploadsDir = path.resolve(process.env.NANDE_UPLOADS_DIR || path.join(dataDir, "uploads"));
  const migrateDir = path.join(dataDir, "reports", "uploads-migrate");
  const ledgerFile = path.resolve(arg("--ledger") ?? path.join(migrateDir, "ledger.jsonl"));

  const runRecords: RunRecord[] = [];
  if (fs.existsSync(migrateDir)) for (const d of fs.readdirSync(migrateDir).filter((x) => /^run-/.test(x)).sort()) {
    const f = path.join(migrateDir, d, "result.json");
    if (!fs.existsSync(f)) continue;
    try { for (const r of JSON.parse(fs.readFileSync(f, "utf8"))) if (r.url === url) runRecords.push({ run: d, action: r.action, verify: r.verify, error: r.error, note: r.note }); } catch { /* 壞檔略過 */ }
  }
  let auditRecord = null;
  const reportsDir = path.join(dataDir, "reports");
  const audits = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).filter((d) => /^uploads-audit-/.test(d)).sort() : [];
  if (audits.length) { try { const rep = JSON.parse(fs.readFileSync(path.join(reportsDir, audits[audits.length - 1]!, "files.json"), "utf8")); const r = rep.records.find((x: any) => x.url === url); if (r) auditRecord = { sha256: r.sha256, size: r.size, publicId: r.publicId, batch: r.batch, status: r.status }; } catch { /* 略過 */ } }

  const { createCloudinaryStorageFromEnv } = await import("../../lib/storage/cloudinary");
  const storage = await createCloudinaryStorageFromEnv();
  const result = await checkOne({
    url, uploadsDir, ledger: readLedger(ledgerFile), runRecords, auditRecord,
    inspect: (u) => storage.inspect(u),
    download: async (info) => {
      const secure = info.secureUrl ? new URL(info.secureUrl) : null;
      if (!secure || secure.protocol !== "https:" || secure.hostname !== "res.cloudinary.com") throw new Error("Cloudinary 沒有回傳可用的 https Secure URL。");
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nande-check-"));
      try {
        const file = path.join(tmp, "download.bin");
        const res = await fetch(secure, { signal: AbortSignal.timeout(15 * 60 * 1000), redirect: "follow" });
        if (!res.ok || !res.body) throw new Error(`下載失敗（HTTP ${res.status}）`);
        const hash = crypto.createHash("sha256"); let bytes = 0;
        await pipeline(Readable.fromWeb(res.body as any), async function* (src: AsyncIterable<Buffer>) { for await (const c of src) { hash.update(c); bytes += c.length; yield c; } }, fs.createWriteStream(file));
        return { sha256: hash.digest("hex"), bytes };
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    },
  });
  console.log(arg("--json") ? JSON.stringify(result, null, 2) : renderCheckOne(result));
}
main().catch((e) => { console.error("❌ 檢查失敗（沒有修改任何檔案）：", String(e?.message ?? e).slice(0, 300)); process.exit(1); });
