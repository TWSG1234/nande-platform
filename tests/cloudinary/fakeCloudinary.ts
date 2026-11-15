/**
 * 假的 Cloudinary 伺服器（只給測試用）：實作 SDK 會呼叫的 upload／rename／destroy，以及 res 端的 GET／HEAD 傳遞網址。
 * 重點：會「真的驗證簽名」——用 API Secret 對參數做 SHA-1，和 SDK 送來的 signature 比對，簽錯就回 401，
 * 並記錄每個請求，讓測試可以檢查 API Secret 沒有出現在送出的內容裡。
 */
import https from "https";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

export interface FakeAsset { body: Buffer; rt: string; format: string }
export function startFakeCloudinary(opts: { cloud: string; key: string; secret: string }) {
  const assets = new Map<string, FakeAsset>(); // key: `${rt}/${public_id}`
  const log: { path: string; fields: Record<string, string>; sigOk: boolean; raw: string }[] = [];
  let failDelivery = 0;
  const negCache = new Set<string>();
  const parseMultipart = (buf: Buffer, ct: string) => {
    const boundary = "--" + /boundary=(.+)$/.exec(ct)![1];
    const fields: Record<string, string> = {}; let file: Buffer | null = null;
    for (const part of buf.toString("binary").split(boundary).slice(1, -1)) {
      const i = part.indexOf("\r\n\r\n"); const head = part.slice(0, i); const body = part.slice(i + 4, part.length - 2);
      const name = /name="([^"]+)"/.exec(head)![1]!;
      if (/filename=/.test(head)) file = Buffer.from(body, "binary"); else fields[name] = Buffer.from(body, "binary").toString("utf8");
    }
    return { fields, file };
  };
  const sigOk = (f: Record<string, string>) => {
    const { file: _f, api_key: _k, resource_type: _r, cloud_name: _c, signature, ...rest } = f as any;
    const str = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("&");
    return f.api_key === opts.key && crypto.createHash("sha1").update(str + opts.secret).digest("hex") === signature;
  };
  // 官方 SDK 一律用 https，所以假伺服器也用一次性自簽憑證（只在測試程式裡關閉憑證驗證）。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fakecld-"));
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/k.pem -out ${dir}/c.pem -days 1 -subj /CN=127.0.0.1 2>/dev/null`);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const server = https.createServer({ key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) }, async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer); const buf = Buffer.concat(chunks);
    const url = new URL(req.url!, "https://x"); const send = (code: number, obj: any) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    const m = /^\/v1_1\/([^/]+)\/(image|video|raw)\/(upload|rename|destroy)$/.exec(url.pathname);
    if (req.method === "POST" && m) {
      const [, cloud, rt, op] = m as any;
      let fields: Record<string, string> = {}; let file: Buffer | null = null;
      const ct = String(req.headers["content-type"] || "");
      if (ct.startsWith("multipart/")) ({ fields, file } = parseMultipart(buf, ct)); else fields = Object.fromEntries(new URLSearchParams(buf.toString()));
      const ok = cloud === opts.cloud && sigOk(fields);
      log.push({ path: url.pathname, fields, sigOk: ok, raw: buf.toString("latin1") });
      if (!ok) return send(401, { error: { message: "Invalid Signature" } });
      if (op === "upload") {
        const id = fields.public_id!; const k = `${rt}/${id}`;
        const fmt = file!.subarray(0, 4).toString("hex") === "89504e47" ? "png" : file!.subarray(0, 3).toString("hex") === "ffd8ff" ? "jpg" : rt === "video" ? "mp4" : file!.toString("utf8", 0, 4) === "<svg" ? "svg" : "bin";
        if (fields.allowed_formats && !fields.allowed_formats.split(",").includes(fmt === "jpg" ? "jpg" : fmt)) return send(400, { error: { message: `Image file format ${fmt} not allowed` } });
        const existing = assets.has(k);
        if (!existing) assets.set(k, { body: file!, rt, format: fmt });
        return send(200, { ...(existing ? { existing: true } : {}), public_id: id, resource_type: rt, format: fmt, bytes: file!.length, version: 1, secure_url: `https://res.cloudinary.com/${cloud}/${rt}/upload/v1/${id}.${fmt}` });
      }
      if (op === "rename") {
        const from = `${rt}/${fields.from_public_id}`, to = `${rt}/${fields.to_public_id}`;
        if (!assets.has(from)) return send(404, { error: { message: `Resource not found - ${fields.from_public_id}` } });
        if (assets.has(to) && fields.overwrite !== "true") return send(400, { error: { message: "to_public_id already exists" } });
        assets.set(to, assets.get(from)!); assets.delete(from); return send(200, { public_id: fields.to_public_id, resource_type: rt });
      }
      if (op === "destroy") { const k = `${rt}/${fields.public_id}`; const had = assets.delete(k); return send(200, { result: had ? "ok" : "not found" }); }
    }
    // Admin API（Basic 驗證）：列表／單一資源。沒有 cloud_name 的設定會打到 /v1_1/undefined/…，這裡回 401 模擬 "Must supply cloud_name"。
    const am = /^\/v1_1\/([^/]+)\/resources\/(image|video)\/upload(?:\/(.+))?$/.exec(decodeURIComponent(url.pathname));
    if (req.method === "GET" && am) {
      const basic = Buffer.from(String(req.headers.authorization || "").replace(/^Basic /, ""), "base64").toString();
      log.push({ path: url.pathname, fields: {}, sigOk: basic === `${opts.key}:${opts.secret}` && am[1] === opts.cloud, raw: "" });
      if (basic !== `${opts.key}:${opts.secret}` || am[1] !== opts.cloud) return send(401, { error: { message: "Invalid credentials" } });
      if (am[3]) { const a = assets.get(`${am[2]}/${am[3]}`); return a ? send(200, { public_id: am[3], version: 1, bytes: a.body.length, format: a.format, secure_url: `https://res.cloudinary.com/${opts.cloud}/${am[2]}/upload/v1/${am[3]}.${a.format}` }) : send(404, { error: { message: "Resource not found - " + am[3] } }); }
      const prefix = url.searchParams.get("prefix") || "";
      return send(200, { resources: [...assets.keys()].filter((k) => k.startsWith(am[2] + "/")).map((k) => k.slice(am[2]!.length + 1)).filter((id) => id.startsWith(prefix)).map((public_id) => ({ public_id })) });
    }
    const d = /^\/([^/]+)\/(image|video)\/upload\/(v\d+\/)?(.+)\.([A-Za-z0-9]+)$/.exec(decodeURI(url.pathname));
    if (req.method === "HEAD" && d) { res.writeHead(404); return res.end(); } // 真實帳號的行為：傳遞網址對 HEAD 回 404，GET 才正常
    if (req.method === "GET" && d) {
      if (failDelivery > 0) { failDelivery--; res.writeHead(503); return res.end(); }
      // 模擬 CDN 的「負面快取」：沒帶版本號的網址只要曾經回過 404，之後就一直回 404（即使檔案後來上傳了）；帶版本號的網址是另一個快取項目。
      const cacheKey = decodeURI(url.pathname);
      const a = assets.get(`${d[2]}/${d[4]}`);
      if (d[1] !== opts.cloud || !a || (!d[3] && negCache.has(cacheKey))) { if (!d[3]) negCache.add(cacheKey); res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": a.rt === "video" ? "video/mp4" : "image/" + a.format, "content-length": a.body.length }); return res.end(a.body);
    }
    res.writeHead(404); res.end();
  });
  return new Promise<{ url: string; assets: typeof assets; log: typeof log; failNextDeliveries(n: number): void; close(): Promise<void> }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ url: `https://127.0.0.1:${(server.address() as any).port}`, assets, log, failNextDeliveries: (n) => (failDelivery = n), close: () => new Promise((r) => server.close(() => r())) })));
}
