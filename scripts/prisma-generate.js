#!/usr/bin/env node
/**
 * 依環境選擇 Prisma schema 並執行 `prisma generate`（package.json 的 build／postinstall／dev／db:generate 都走這裡）。
 *
 * 規則：
 *   1. 環境變數 PRISMA_SCHEMA_TARGET=sqlite|postgres 明確指定時優先（Vercel 上不允許 sqlite）。
 *   2. 否則在 Vercel（VERCEL=1）使用 prisma/schema.postgres.prisma。
 *   3. 否則（本機）使用 prisma/schema.prisma（SQLite）。
 * 只會執行 `prisma generate`：不連資料庫、不 push、不 migrate、不 seed。
 *
 * 測試用選項：--print-only（只印出選擇結果，不執行）、--root <資料夾>（專案根目錄，預設為本腳本的上一層）。
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const FILES = { sqlite: "prisma/schema.prisma", postgres: "prisma/schema.postgres.prisma" };

function choose(env, root) {
  const raw = String(env.PRISMA_SCHEMA_TARGET || "").trim().toLowerCase();
  const onVercel = Boolean(env.VERCEL);
  let target;
  if (raw) {
    if (raw === "sqlite") target = "sqlite";
    else if (raw === "postgres" || raw === "postgresql") target = "postgres";
    else return { error: `PRISMA_SCHEMA_TARGET 只能是 sqlite 或 postgres（目前是 "${raw}"）。` };
    if (onVercel && target === "sqlite") return { error: "Vercel 上不可使用 SQLite schema（PRISMA_SCHEMA_TARGET=sqlite）。請移除這個環境變數。" };
  } else target = onVercel ? "postgres" : "sqlite";
  const file = path.join(root, FILES[target]);
  if (!fs.existsSync(file)) return { error: `找不到 schema 檔案：${FILES[target]}。${onVercel ? "Vercel 上不會退回 SQLite，已中止 build。" : ""}` };
  const text = fs.readFileSync(file, "utf8").replace(/\/\/.*$/gm, ""); // 去掉註解（註解裡可能寫著別的 provider）
  const provider = (/datasource\s+\w+\s*\{[^}]*?provider\s*=\s*"([^"]+)"/.exec(text) || [])[1];
  const expected = target === "postgres" ? "postgresql" : "sqlite";
  if (provider !== expected) return { error: `${FILES[target]} 的 provider 是 "${provider}"，應為 "${expected}"。` };
  return { target, file, rel: FILES[target], provider, onVercel, explicit: Boolean(raw) };
}

function main() {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf("--root");
  const root = path.resolve(ri >= 0 ? argv[ri + 1] : path.join(__dirname, ".."));
  const sel = choose(process.env, root);
  if (sel.error) { console.error("❌ [prisma-generate] " + sel.error); process.exit(1); }
  console.log(`[prisma-generate] 使用 ${sel.rel}（${sel.provider}）${sel.onVercel ? "｜Vercel" : "｜本機"}${sel.explicit ? "｜由 PRISMA_SCHEMA_TARGET 指定" : ""}`);
  if (sel.target === "postgres" && !sel.onVercel) console.warn("⚠ [prisma-generate] 本機正在產生 PostgreSQL Client：SQLite 維運工具與本機開發會暫時無法使用。要還原請不帶 PRISMA_SCHEMA_TARGET 重新執行 npm run db:generate。");
  if (argv.includes("--print-only")) { console.log(JSON.stringify({ target: sel.target, schema: sel.rel, provider: sel.provider })); return; }
  let cli;
  try { cli = require.resolve("prisma/build/index.js", { paths: [root] }); } catch { console.error("❌ [prisma-generate] 找不到 prisma 套件，請先 npm install。"); process.exit(1); }
  const res = spawnSync(process.execPath, [cli, "generate", "--schema", sel.file], { stdio: "inherit", cwd: root, env: process.env });
  process.exit(res.status === null ? 1 : res.status);
}
if (require.main === module) main();
module.exports = { choose };
