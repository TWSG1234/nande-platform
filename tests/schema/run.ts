/**
 * SQLite／PostgreSQL 雙 schema、環境選擇、Vercel 資料庫環境防護、遠端維運工具阻擋 測試：npm run test:schema
 * 全部不連任何資料庫、不修改任何資料（遠端工具測試用一個連不上的假位址，並且工具應該在連線前就被拒絕）。
 */
import assert from "assert";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { checkRemoteEnvironment, dbHostOf, resolveDataConfig, DataConfigError } from "../../lib/config/dataConfig";
import { compareSchemaFiles, compareSchemaPair } from "../../prisma/tools/schemaSync";
import { guardProject } from "../../prisma/tools/guardCore";

const P = path.resolve(__dirname, "../..") + "/";
let pass = 0, fail = 0;
const t = async (n: string, f: () => any) => { try { await f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "->", (e as Error).message); } };
const sqliteText = fs.readFileSync(P + "prisma/schema.prisma", "utf8");
const pgText = fs.readFileSync(P + "prisma/schema.postgres.prisma", "utf8");
const pkg = JSON.parse(fs.readFileSync(P + "package.json", "utf8"));
const PW = "SECRETPW" + process.pid;
const FAKE = `postgresql://u:${PW}@127.0.0.1:1/db`; // 連不上的位址：任何連線嘗試都會失敗

const run = (script: string, args: string[], env: Record<string, string | undefined>, cwd = P) => {
  const e: NodeJS.ProcessEnv = { ...process.env, HOME: os.tmpdir(), USERPROFILE: os.tmpdir() };
  for (const k of ["VERCEL", "VERCEL_ENV", "NANDE_DB_MODE", "NANDE_DB_TARGET", "NANDE_PROD_DB_HOST", "NANDE_DATA_DIR", "DATABASE_URL", "DIRECT_URL", "PRISMA_SCHEMA_TARGET"]) delete e[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) e[k] = v;
  return spawnSync(process.execPath, script.endsWith(".js") ? [script, ...args] : [P + "node_modules/tsx/dist/cli.mjs", script, ...args], { cwd, env: e, encoding: "utf8", timeout: 120_000 });
};
const GEN = P + "scripts/prisma-generate.js";
const pick = (env: Record<string, string>, root = P) => { const r = run(GEN, ["--print-only", "--root", root], env); return { status: r.status, out: r.stdout, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout.trim().split("\n").pop()!); } catch { return null; } })() }; };

(async () => {
  // ───── A. Schema 一致性 ─────
  await t("A1 目前兩份 schema：37 個 model 逐字一致，provider／binaryTargets／directUrl 正確", () => {
    const r = compareSchemaFiles(P)!; assert.deepEqual(r.problems, []); assert.ok(r.ok); assert.equal(r.models, 37);
    assert.equal(sqliteText.match(/^model /gm)!.length, 37); assert.equal(pgText.match(/^model /gm)!.length, 37);
  });
  await t("A2 偵測不一致：新增欄位／缺 model／多 model／改欄位型別／provider 錯／缺 rhel／缺 directUrl", () => {
    const bad = (f: (s: string) => string) => compareSchemaPair(sqliteText, f(pgText));
    assert.ok(bad((s) => s.replace("model Admin {", "model Admin {\n  extra String?")).problems.some((p) => /Admin/.test(p)));
    assert.ok(bad((s) => s.replace(/^model Comment \{[\s\S]*?^\}/m, "")).problems.some((p) => /缺少 model Comment/.test(p)));
    assert.ok(bad((s) => s + "\nmodel Extra {\n  id String @id\n}\n").problems.some((p) => /多出 model Extra/.test(p)));
    assert.ok(bad((s) => s.replace("passwordHash String", "passwordHash Int")).problems.length > 0);
    assert.ok(bad((s) => s.replace('provider  = "postgresql"', 'provider  = "mysql"')).problems.some((p) => /postgresql/.test(p)));
    assert.ok(bad((s) => s.replace(', "rhel-openssl-3.0.x"', "")).problems.some((p) => /rhel/.test(p)));
    assert.ok(bad((s) => s.replace('directUrl = env("DIRECT_URL")', "")).problems.some((p) => /directUrl/.test(p)));
    assert.ok(compareSchemaPair(sqliteText.replace('provider = "sqlite"', 'provider = "postgresql"'), pgText).problems.some((p) => /sqlite/.test(p)));
    assert.ok(bad((s) => s.replace("String   @id", "String   @id @db.VarChar(30)")).problems.some((p) => /@db/.test(p)));
  });
  await t("A3 SQLite schema 本身沒被改動：provider 仍是 sqlite、沒有 directUrl／binaryTargets", () => {
    const code = sqliteText.replace(/\/\/.*$/gm, ""); assert.match(code, /provider = "sqlite"/); assert.ok(!/directUrl|binaryTargets/.test(code));
  });

  // ───── B. 環境選擇 ─────
  await t("B1 本機預設 → SQLite schema", () => { const r = pick({}); assert.equal(r.status, 0, r.err); assert.deepEqual(r.json, { target: "sqlite", schema: "prisma/schema.prisma", provider: "sqlite" }); });
  await t("B2 Vercel（VERCEL=1）→ PostgreSQL schema；Preview／Production 都一樣", () => {
    for (const ve of ["production", "preview", "development", ""]) { const r = pick({ VERCEL: "1", VERCEL_ENV: ve }); assert.equal(r.status, 0, r.err); assert.equal(r.json.target, "postgres"); assert.equal(r.json.provider, "postgresql"); }
  });
  await t("B3 PRISMA_SCHEMA_TARGET：本機可指定 postgres（附警告）；Vercel 上指定 sqlite 會失敗；值不合法會失敗", () => {
    const a = pick({ PRISMA_SCHEMA_TARGET: "postgres" }); assert.equal(a.json.target, "postgres"); assert.match(a.err, /SQLite 維運工具/);
    assert.equal(pick({ PRISMA_SCHEMA_TARGET: "postgresql" }).json.target, "postgres");
    assert.equal(pick({ PRISMA_SCHEMA_TARGET: "SQLITE" }).json.target, "sqlite");
    const b = pick({ VERCEL: "1", PRISMA_SCHEMA_TARGET: "sqlite" }); assert.notEqual(b.status, 0); assert.match(b.err, /Vercel 上不可使用 SQLite/);
    const c = pick({ PRISMA_SCHEMA_TARGET: "mysql" }); assert.notEqual(c.status, 0); assert.match(c.err, /只能是 sqlite 或 postgres/);
  });
  await t("B4 Vercel 缺少 PostgreSQL schema → build 中止，不會退回 SQLite；provider 與檔案不符也會失敗", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nande-root-")); fs.mkdirSync(path.join(d, "prisma")); fs.writeFileSync(path.join(d, "prisma/schema.prisma"), sqliteText);
    const r = pick({ VERCEL: "1" }, d); assert.notEqual(r.status, 0); assert.match(r.err, /找不到 schema/); assert.ok(!r.out.includes("sqlite"));
    fs.writeFileSync(path.join(d, "prisma/schema.postgres.prisma"), sqliteText); // 內容其實是 sqlite
    const r2 = pick({ VERCEL: "1" }, d); assert.notEqual(r2.status, 0); assert.match(r2.err, /provider/);
    assert.equal(pick({}, d).json.target, "sqlite");
  });
  await t("B5 package.json：build／postinstall／dev／db:generate 都走選擇腳本，不再直接 prisma generate", () => {
    for (const k of ["build", "postinstall", "dev", "db:generate"]) { assert.match(pkg.scripts[k], /node scripts\/prisma-generate\.js/, k); assert.ok(!/(^|&& )prisma generate/.test(pkg.scripts[k]), k); }
    assert.match(pkg.scripts.build, /next build$/); assert.equal(pkg.scripts["test:schema"], "tsx tests/schema/run.ts");
    for (const k of ["db:push", "db:migrate", "db:seed", "db:restore-life"]) assert.ok(pkg.scripts[k], k + " 仍存在（只是遠端會被阻擋）");
  });

  // ───── C. Vercel 資料庫環境防護 ─────
  const PROD = "ep-prod-1.ap-southeast-1.aws.neon.tech", PREV = "ep-prev-9.ap-southeast-1.aws.neon.tech";
  const u = (h: string) => `postgresql://user:${PW}@${h}/db?sslmode=require`;
  const guard = (env: Record<string, string>, url: string) => checkRemoteEnvironment({ ...env } as unknown as NodeJS.ProcessEnv, url);
  await t("C1 非 Vercel：行為與以前完全相同（不檢查）", () => { assert.equal(guard({}, u(PROD)), null); assert.equal(guard({ NANDE_DB_TARGET: "preview" }, u(PROD)), null); });
  await t("C2 Vercel 沒宣告 NANDE_DB_TARGET → 拒絕（Production／Preview 都是）", () => {
    for (const ve of ["production", "preview"]) assert.match(guard({ VERCEL: "1", VERCEL_ENV: ve }, u(PROD))!, /NANDE_DB_TARGET/);
    assert.match(guard({ VERCEL: "1", VERCEL_ENV: "production", NANDE_DB_TARGET: "staging" }, u(PROD))!, /NANDE_DB_TARGET/);
  });
  await t("C3 Production：target=production 通過；pooler／直連視為同一主機；主機與 NANDE_PROD_DB_HOST 不符 → 拒絕；target=preview → 拒絕", () => {
    const base = { VERCEL: "1", VERCEL_ENV: "production", NANDE_DB_TARGET: "production" };
    assert.equal(guard(base, u(PROD)), null);
    assert.equal(guard({ ...base, NANDE_PROD_DB_HOST: PROD }, u("ep-prod-1-pooler.ap-southeast-1.aws.neon.tech")), null);
    assert.match(guard({ ...base, NANDE_PROD_DB_HOST: PROD }, u(PREV))!, /不一致/);
    assert.match(guard({ ...base, NANDE_DB_TARGET: "preview" }, u(PROD))!, /不是 production/);
  });
  await t("C4 Preview：必須 target=preview、必須設 NANDE_PROD_DB_HOST、主機不能等於正式（含 pooler 寫法與 https:// 前綴）", () => {
    const base = { VERCEL: "1", VERCEL_ENV: "preview", NANDE_DB_TARGET: "preview", NANDE_PROD_DB_HOST: PROD };
    assert.equal(guard(base, u(PREV)), null);
    assert.match(guard(base, u(PROD))!, /指向正式資料庫/);
    assert.match(guard(base, u("ep-prod-1-pooler.ap-southeast-1.aws.neon.tech"))!, /指向正式資料庫/);
    assert.match(guard({ ...base, NANDE_PROD_DB_HOST: "https://" + PROD }, u(PROD))!, /指向正式資料庫/);
    assert.match(guard({ ...base, NANDE_PROD_DB_HOST: undefined as never }, u(PREV))!, /必須設定 NANDE_PROD_DB_HOST/);
    assert.match(guard({ ...base, NANDE_DB_TARGET: "production" }, u(PREV))!, /Preview 不可使用正式資料庫設定/);
    assert.match(guard({ ...base, DIRECT_URL: u(PROD) }, u(PREV))!, /DIRECT_URL 指向正式資料庫/);
    assert.equal(guard({ ...base, DIRECT_URL: u(PREV) }, u(PREV)), null);
  });
  await t("C5 Vercel Development／無法判斷的 VERCEL_ENV 一律當 Preview（失敗即關閉）", () => {
    for (const ve of ["development", "", "weird"]) assert.match(guard({ VERCEL: "1", VERCEL_ENV: ve, NANDE_DB_TARGET: "preview", NANDE_PROD_DB_HOST: PROD }, u(PROD))!, /指向正式資料庫/);
  });
  await t("C6 錯誤訊息不含連線字串、密碼或使用者名稱", () => {
    for (const [env, url] of [[{ VERCEL: "1", VERCEL_ENV: "preview", NANDE_DB_TARGET: "preview", NANDE_PROD_DB_HOST: PROD }, u(PROD)], [{ VERCEL: "1" }, u(PROD)], [{ VERCEL: "1", VERCEL_ENV: "production", NANDE_DB_TARGET: "production", NANDE_PROD_DB_HOST: PROD }, u(PREV)]] as const) {
      const m = guard({ ...env }, url)!; assert.ok(m && !m.includes(PW) && !/postgres(ql)?:\/\//.test(m) && !m.includes("user:"));
    }
  });
  await t("C7 整合 resolveDataConfig：Vercel Preview 連正式 → DataConfigError；設定正確 → 回傳 remote；非 Vercel remote 行為不變；SQLite URL 仍被拒", () => {
    const env = (o: Record<string, string>) => ({ NANDE_DB_MODE: "remote", DATABASE_URL: u(PREV), ...o }) as unknown as NodeJS.ProcessEnv;
    assert.throws(() => resolveDataConfig({ env: env({ VERCEL: "1", VERCEL_ENV: "preview", NANDE_DB_TARGET: "preview", NANDE_PROD_DB_HOST: PREV }) }), (e: Error) => e instanceof DataConfigError && /指向正式資料庫/.test(e.message) && !e.message.includes(PW));
    const ok = resolveDataConfig({ env: env({ VERCEL: "1", VERCEL_ENV: "preview", NANDE_DB_TARGET: "preview", NANDE_PROD_DB_HOST: PROD }) }); assert.equal(ok.mode, "remote");
    assert.equal(resolveDataConfig({ env: env({}) }).mode, "remote");
    assert.throws(() => resolveDataConfig({ env: env({ DATABASE_URL: "file:./dev.db" }) }), /不可使用 SQLite/);
    assert.throws(() => resolveDataConfig({ env: { NANDE_DB_MODE: "remote" } as unknown as NodeJS.ProcessEnv }), /DATABASE_URL/);
    assert.equal(dbHostOf("postgresql://u:p@EP-A-POOLER.x.neon.tech/db"), "ep-a.x.neon.tech"); assert.equal(dbHostOf("garbage"), null);
  });
  await t("C8 本機模式不受影響：local 模式仍要求固定資料夾與 dev.db，且忽略 DATABASE_URL", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nande-data-")); fs.writeFileSync(path.join(d, "dev.db"), "");
    const cfg = resolveDataConfig({ env: { NANDE_DATA_DIR: d, DATABASE_URL: u(PROD), VERCEL: "1" } as unknown as NodeJS.ProcessEnv, projectDir: P }); assert.equal(cfg.mode, "local"); assert.ok(cfg.dbUrl.startsWith("file:"));
    assert.throws(() => resolveDataConfig({ env: {} as unknown as NodeJS.ProcessEnv, home: d }), DataConfigError);
  });

  // ───── D. 遠端維運工具阻擋 ─────
  const REMOTE = { NANDE_DB_MODE: "remote", DATABASE_URL: FAKE, DIRECT_URL: FAKE };
  const blocked = (script: string, args: string[] = []) => {
    const r = run(P + script, [...args, "--confirm"], REMOTE); const all = r.stdout + r.stderr;
    assert.equal(r.status, 1, `${script} 應被拒絕（結束碼 1）：${all.slice(0, 300)}`);
    assert.match(all, /沒有連線也沒有改動任何資料|只支援本機|只用於本機/, script); assert.ok(!all.includes(PW), "輸出不可含密碼"); assert.ok(!/ECONNREFUSED|connect/i.test(all), "不可嘗試連線：" + script);
  };
  const TOOLS = ["prisma/tools/doctor.ts", "prisma/tools/backup.ts", "prisma/tools/verifyBackups.ts", "prisma/tools/update.ts", "prisma/tools/restoreLife.ts", "prisma/tools/contentPatch.ts", "prisma/tools/calendarImages.ts", "prisma/tools/uploadsAudit.ts", "prisma/tools/uploadsMigrate.ts", "prisma/seed.ts", "prisma/import-life-comics.ts", "prisma/import-life-vocabulary.ts", "prisma/reset-life-chinese.ts", "prisma/import-life-all.ts"];
  for (const tool of TOOLS) await t(`D 遠端模式下 ${tool} 立即拒絕（連 --confirm、--apply 也不行），不連線、不洩漏密碼`, () => blocked(tool, tool.endsWith("calendarImages.ts") ? [os.tmpdir(), "--apply"] : ["--apply"]));
  for (const args of [["db", "push"], ["migrate", "dev"], ["migrate", "deploy"], ["migrate", "reset"], ["db", "push", "--force-reset"], ["studio"], ["db", "seed"]])
    await t(`D 遠端模式下 prismaCli ${args.join(" ")} 被拒絕`, () => { const r = run(P + "prisma/tools/prismaCli.ts", args, REMOTE); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /沒有連線也沒有改動任何資料|只用於本機|清除或重設資料/); assert.ok(!(r.stdout + r.stderr).includes(PW)); assert.ok(!/ECONNREFUSED/.test(r.stdout + r.stderr)); });
  await t("D 本機模式下 prismaCli 拒絕 --schema 與連線字串參數（不能被指到 PostgreSQL schema／Neon）", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nande-data-")); fs.writeFileSync(path.join(d, "dev.db"), "");
    for (const a of [["db", "push", "--schema", "prisma/schema.postgres.prisma"], ["db", "push", "--schema=prisma/schema.postgres.prisma"], ["studio", FAKE]]) {
      const r = run(P + "prisma/tools/prismaCli.ts", a, { NANDE_DATA_DIR: d }); assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout + r.stderr, /只用於本機 SQLite/);
    }
  });
  await t("D 唯讀的啟動檢查 check.ts 在遠端模式仍可執行（不被誤擋），且不寫入", () => { const r = run(P + "prisma/tools/check.ts", [], REMOTE); assert.equal(r.status, 0, r.stdout + r.stderr); assert.ok(!(r.stdout + r.stderr).includes(PW)); });
  await t("D 本機模式下維運工具照常運作（doctor 讀一個暫時的空 SQLite 檔會正常報錯或回報，而不是被遠端防護擋住）", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nande-data-")); fs.writeFileSync(path.join(d, "dev.db"), "");
    const r = run(P + "prisma/tools/backup.ts", [], { NANDE_DATA_DIR: d }); assert.ok(!/遠端資料庫模式/.test(r.stdout + r.stderr), "本機模式不該出現遠端拒絕訊息");
  });

  // ───── E. 專案衛生檢查與既有功能相容 ─────
  await t("E1 check:project（guardProject）對目前專案：沒有 schema／script 相關錯誤", () => {
    const f = guardProject(P).filter((x) => x.level === "error"); assert.deepEqual(f, []);
  });
  await t("E2 guardProject 能抓到：schema 不一致、build 又改回直接 prisma generate", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nande-guard-")); fs.mkdirSync(path.join(d, "prisma"));
    fs.writeFileSync(path.join(d, "prisma/schema.prisma"), sqliteText); fs.writeFileSync(path.join(d, "prisma/schema.postgres.prisma"), pgText.replace("model Admin {", "model Admin {\n  x String?"));
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ scripts: { build: "prisma generate && next build", postinstall: "prisma generate" } }));
    const m = guardProject(d).map((x) => x.message).join("\n"); assert.match(m, /schema 不一致/); assert.match(m, /build 直接執行 prisma generate/); assert.match(m, /postinstall 直接執行 prisma generate/);
  });
  await t("E3 既有功能原始碼未被改動：lib/prisma.ts、Cloudinary、Google Drive、登入、上傳路由、next.config.js", () => {
    // 這些檔案的內容雜湊與本次修改前相同（由 tests/schema/baseline.json 記錄；若你刻意修改它們，請更新 baseline）
    const base = JSON.parse(fs.readFileSync(P + "tests/schema/baseline.json", "utf8")) as Record<string, string>;
    const crypto = require("crypto");
    for (const [f, h] of Object.entries(base)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(P + f)).digest("hex"), h, f + " 被改動了");
    assert.ok(Object.keys(base).length >= 15);
  });
  console.log(`\n${pass} 項通過、${fail} 項失敗`);
  process.exit(fail ? 1 : 0);
})();
