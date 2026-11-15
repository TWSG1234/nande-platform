/**
 * 用「你自己的 Cloudinary 帳號」做一次真實連線自我檢查（npm run check:cloudinary）。
 * - 需要環境變數 CLOUDINARY_CLOUD_NAME／API_KEY／API_SECRET（或 CLOUDINARY_URL），可寫在 .env.local。
 * - 只會在 Cloudinary 的 <CLOUDINARY_FOLDER>/selftest/ 底下建立、讀取、刪除「它自己產生的 1x1 測試小圖」，
 *   不碰任何網站圖片、不碰資料庫、不碰本機資料夾。結果只顯示通過／失敗，不顯示任何金鑰。
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

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
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function main() {
  loadEnvLocal();
  const { cloudinaryConfigFromEnv, createCloudinaryStorage, applyCloudinaryConfig } = await import("../../lib/storage/cloudinary");
  const cfg = cloudinaryConfigFromEnv();
  const { v2 } = await import("cloudinary");
  applyCloudinaryConfig(v2, cfg); // 所有 SDK 操作（uploader、Admin API）共用同一份伺服器端設定
  const auth = { cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret };
  const base = { ...cfg, uploader: v2.uploader as any, api: v2.api as any };
  const trashMode = createCloudinaryStorage({ ...base, deleteMode: "trash" });
  const destroyMode = createCloudinaryStorage({ ...base, deleteMode: "destroy" });
  let bad = 0;
  const step = async (name: string, f: () => Promise<boolean>) => {
    try {
      const ok = await f();
      if (!ok) bad++;
      console.log(ok ? "✅" : "❌", name);
    } catch (e) {
      bad++;
      console.log("❌", name, "—", String((e as Error).message).slice(0, 160));
    }
  };
  // 刪除後 CDN 可能還有短暫快取：最多等約 15 秒，每 1.5 秒確認一次「網址已失效」；逾時就如實判定失敗，不當作成功。
  const gone = async (st: { exists(u: string): Promise<boolean> }, u: string) => {
    for (let i = 0; i < 10; i++) {
      if (!(await st.exists(u))) return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };
  const a = `${crypto.randomUUID()}.png`;
  let url = "";
  await step("簽名上傳 1x1 PNG", async () => ((url = await destroyMode.put("selftest", a, PNG)), url === `/uploads/selftest/${a}`));
  await step("檢查存在（exists）", async () => {
    const r = await destroyMode.exists(url);
    if (!r) console.log("   ↳ exists 回傳 false，但剛上傳成功，請把這行回報");
    return r === true;
  });
  await step("讀取內容與上傳一致（read）", async () => (await destroyMode.read(url))?.equals(PNG) === true);
  await step("Secure URL 為 https 且可公開讀取", async () => {
    const u = destroyMode.deliveryUrl(url)!;
    const r = await fetch(u);
    return u.startsWith("https://") && r.ok && (r.headers.get("content-type") || "").startsWith("image/");
  });
  await step("不覆蓋：同檔名再上傳會被拒絕", async () => destroyMode.put("selftest", a, PNG).then(() => false, () => true));
  await step("刪除（destroy 模式，只刪這張測試圖）", async () => (await destroyMode.remove(url), await gone(destroyMode, url)));
  const b = `${crypto.randomUUID()}.png`;
  await step("回收區流程：上傳→移到 _trash→原網址失效", async () => {
    const u = await trashMode.put("selftest", b, PNG);
    await trashMode.remove(u);
    return await gone(trashMode, u);
  });
  await step("清掉回收區裡這張測試圖", async () => {
    // 只刪除「回收區裡、名稱以 selftest__<這次測試的 UUID> 結尾」的那一張，其他資料一律不碰。
    const suffix = `-selftest__${b.replace(".png", "")}`;
    const res: any = await v2.api.resources({ ...auth, resource_type: "image", type: "upload", prefix: `${cfg.folder}/_trash/`, max_results: 500 });
    const mine = (res.resources as any[]).filter((r) => String(r.public_id).startsWith(`${cfg.folder}/_trash/`) && String(r.public_id).endsWith(suffix));
    for (const r of mine) await v2.uploader.destroy(r.public_id, { ...auth, resource_type: "image", type: "upload", invalidate: true });
    return mine.length === 1;
  });
  console.log(bad ? `\n有 ${bad} 項失敗` : "\n全部通過");
  process.exit(bad ? 1 : 0);
}
main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
