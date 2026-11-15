/**
 * 搬移工具的「SQLite Prisma Reader」：在【系統暫存目錄】建立獨立、唯一的工作區，產生只讀 SQLite 複本用的 Prisma Client，
 * 以【獨立子程序】讀出全部資料後結束，再安全清除工作區。
 *
 * 為什麼這樣設計（Windows 實際會遇到的問題）：
 * 1. 不在專案 node_modules 內建立資料夾：該處可能被防毒／OneDrive 同步／正在執行的 next dev 鎖住，且與專案套件混在一起。
 * 2. Prisma 的查詢引擎是原生 DLL。若在本程序內載入，Windows 會鎖住它直到程序結束，這時刪除工作區必定 EPERM。
 *    所以讀取在子程序中進行，子程序結束後 DLL 釋放，才清除工作區。
 * 3. `prisma generate` 會從 schema 所在資料夾往上找 prisma 與 @prisma/client，找不到時會嘗試自動安裝套件（會在暫存目錄建 package.json、跑 npm）。
 *    為避免這件事，工作區內只放兩個「指向專案套件的連結」（Windows 用 junction，不需系統管理員）。
 *    清除時一律先移除連結、確認專案套件仍在，並確認工作區內已沒有任何連結，才會遞迴刪除，絕不會跟著連結刪到專案的 node_modules。
 * 4. 清除失敗只回報，不影響搬移結果與任何來源資料；下次執行會自動清掉自己遺留的舊工作區（必須有本工具的標記檔）。
 */
import crypto from "crypto";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import type { SourceData } from "./pgMigrateCore";
import { toSqliteReaderSchema } from "./pgMigrateCore";

export const WORKSPACE_PREFIX = "nande-sqlite-reader-";
const MARKER = ".nande-reader-workspace";
const MARKER_TEXT = "created-by-nande-pg-migrate\n";

export interface Workspace { dir: string; base: string; schemaFile: string; outDir: string; resultFile: string; scriptFile: string }
export interface CleanupResult { ok: boolean; dir: string; error?: string }

const isInside = (child: string, parent: string) => { const r = path.relative(path.resolve(parent), path.resolve(child)); return !!r && !r.startsWith("..") && !path.isAbsolute(r); };
const hasNodeModulesSegment = (p: string) => path.resolve(p).split(/[\\/]+/).some((s) => s.toLowerCase() === "node_modules");
const errMsg = (e: unknown) => { const x = e as NodeJS.ErrnoException; return `${x.code ? x.code + "：" : ""}${x.message ?? String(e)}`; };

export function resolveTempBase(override?: string): string {
  const base = path.resolve(override || process.env.NANDE_TEMP_DIR || os.tmpdir());
  if (hasNodeModulesSegment(base)) throw new Error(`暫存目錄不可位於 node_modules 內：${base}。請改用系統 TEMP，或用 --tmp-dir 指定其他資料夾。`);
  return base;
}

/** 建立唯一工作區（mkdtemp 會自動避開已存在的名稱）。無法寫入時給出明確訊息。 */
export function createWorkspace(baseOverride?: string): Workspace {
  const base = resolveTempBase(baseOverride);
  let dir: string;
  try {
    fs.mkdirSync(base, { recursive: true });
    dir = fs.mkdtempSync(path.join(base, WORKSPACE_PREFIX));
    fs.writeFileSync(path.join(dir, MARKER), MARKER_TEXT, { flag: "wx" });
    const probe = path.join(dir, ".probe"); fs.writeFileSync(probe, "x"); fs.unlinkSync(probe);
  } catch (e) {
    throw new Error(`無法在暫存目錄建立工作資料夾（${base}）：${errMsg(e)}。這不是搬移資料的問題，也不需要系統管理員身分；請確認該資料夾可寫入（防毒／受控資料夾存取可能擋住），或用 --tmp-dir "D:\\可寫入的資料夾" 指定別的位置。沒有讀取或修改任何資料。`);
  }
  return { dir, base, schemaFile: path.join(dir, "schema.prisma"), outDir: path.join(dir, "client"), resultFile: path.join(dir, "result.json"), scriptFile: path.join(dir, "reader.js") };
}

function isLink(p: string) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }
/** 在工作區內放兩個指向專案套件的連結，讓 prisma generate 找得到 prisma 與 @prisma/client（不複製、不安裝）。 */
export function linkProjectPackages(ws: Workspace, projectDir: string): string[] {
  const resolveDir = (pkg: string) => path.dirname(require.resolve(pkg + "/package.json", { paths: [projectDir] }));
  const pairs: [string, string][] = [[path.join(ws.dir, "node_modules", "prisma"), resolveDir("prisma")], [path.join(ws.dir, "node_modules", "@prisma", "client"), resolveDir("@prisma/client")]];
  const made: string[] = [];
  for (const [link, target] of pairs) {
    fs.mkdirSync(path.dirname(link), { recursive: true });
    try { fs.symlinkSync(target, link, "junction"); } catch (e) { throw new Error(`無法建立指向專案套件的連結（${path.basename(link)}）：${errMsg(e)}`); }
    made.push(link);
  }
  return made;
}
function removeLink(link: string) {
  if (!isLink(link)) return;
  try { fs.unlinkSync(link); } catch { fs.rmdirSync(link); } // Windows 的 junction 要用 rmdir（不遞迴，只移除連結本身）
}
function containsLink(dir: string): boolean {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name); const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) return true;
    if (st.isDirectory() && containsLink(p)) return true;
  }
  return false;
}
function sleepSync(ms: number) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

/** 安全清除工作區。只刪除「本工具建立（有標記檔）且直接位於暫存目錄下」的資料夾；絕不會跟著連結刪除專案套件；失敗只回報。 */
export function removeWorkspace(dir: string, baseOverride?: string, attempts = 6, delayMs = 250): CleanupResult {
  const resolved = path.resolve(dir);
  try {
    const base = resolveTempBase(baseOverride);
    if (path.dirname(resolved) !== base || !path.basename(resolved).startsWith(WORKSPACE_PREFIX)) return { ok: false, dir: resolved, error: "拒絕清除：不是本工具在暫存目錄下建立的工作區。" };
    if (!fs.existsSync(resolved)) return { ok: true, dir: resolved };
    if (isLink(resolved) || !fs.existsSync(path.join(resolved, MARKER))) return { ok: false, dir: resolved, error: "拒絕清除：缺少本工具的標記檔（或本身是連結）。" };
    let last: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        removeLink(path.join(resolved, "node_modules", "prisma")); removeLink(path.join(resolved, "node_modules", "@prisma", "client"));
        if (containsLink(resolved)) return { ok: false, dir: resolved, error: "拒絕清除：工作區內仍有連結，為避免刪到專案套件已停止（請手動刪除該資料夾）。" };
        fs.rmSync(resolved, { recursive: true, force: true });
        if (!fs.existsSync(resolved)) return { ok: true, dir: resolved };
      } catch (e) { last = e; }
      sleepSync(delayMs * (i + 1));
    }
    return { ok: false, dir: resolved, error: last ? errMsg(last) : "資料夾仍然存在" };
  } catch (e) { return { ok: false, dir: resolved, error: errMsg(e) }; }
}
/** 清掉本工具過去遺留、超過 maxAgeMs 的工作區（需有標記檔）。 */
export function sweepStaleWorkspaces(baseOverride?: string, maxAgeMs = 3600_000, now = Date.now()): { removed: number; failed: string[] } {
  const out = { removed: 0, failed: [] as string[] };
  let base: string; try { base = resolveTempBase(baseOverride); } catch { return out; }
  let names: string[] = []; try { names = fs.readdirSync(base); } catch { return out; }
  for (const n of names) {
    if (!n.startsWith(WORKSPACE_PREFIX)) continue;
    const d = path.join(base, n);
    try { if (!fs.existsSync(path.join(d, MARKER)) || now - fs.statSync(d).mtimeMs < maxAgeMs) continue; } catch { continue; }
    const r = removeWorkspace(d, base, 2, 100); if (r.ok) out.removed++; else out.failed.push(d);
  }
  return out;
}

/** 子程序腳本（純 JS）：載入產生出來的 Client、確認連到的是複本、讀出所有 model、寫成 JSON（日期加標記）。 */
export const READER_SCRIPT = `"use strict";
const fs = require("fs");
const [, , outDir, resultFile, copyPath, modelsJson] = process.argv;
const done = (o, code) => { fs.writeFileSync(resultFile, JSON.stringify(o, function (k, v) { const raw = this[k]; if (raw instanceof Date) return { $d: raw.toISOString() }; if (typeof raw === "bigint") return { $b: String(raw) }; return v; })); process.exit(code); };
(async () => {
  let client;
  try {
    const { PrismaClient } = require(outDir);
    client = new PrismaClient({ datasources: { db: { url: "file:" + copyPath.replace(/\\\\/g, "/") } }, log: [] });
    const dbl = await client.$queryRawUnsafe("PRAGMA database_list");
    const main = dbl.find((r) => r.name === "main");
    const data = {};
    for (const m of JSON.parse(modelsJson)) data[m] = await client[m.charAt(0).toLowerCase() + m.slice(1)].findMany();
    await client.$disconnect();
    done({ dbFile: main ? String(main.file) : null, data }, 0);
  } catch (e) { try { if (client) await client.$disconnect(); } catch {} done({ error: String(e && e.message ? e.message : e).slice(0, 1500) }, 1); }
})();
`;

export interface GenerateRun { status: number | null; output: string }
export type GenerateRunner = (schemaFile: string, cwd: string, env: NodeJS.ProcessEnv) => GenerateRun;
export type ReaderRunner = (ws: Workspace, copyPath: string, models: string[], env: NodeJS.ProcessEnv) => { status: number | null; output: string };

export const defaultRunGenerate: GenerateRunner = (schemaFile, cwd, env) => {
  const cli = require.resolve("prisma/build/index.js", { paths: [cwd] });
  const r = spawnSync(process.execPath, [cli, "generate", "--schema", schemaFile], { cwd, env, encoding: "utf8", timeout: 300_000 });
  return { status: r.status, output: `${r.stderr ?? ""}${r.stdout ?? ""}${r.error ? " " + r.error.message : ""}` };
};
export const defaultRunReader: ReaderRunner = (ws, copyPath, models, env) => {
  const r = spawnSync(process.execPath, [ws.scriptFile, ws.outDir, ws.resultFile, copyPath, JSON.stringify(models)], { cwd: ws.dir, env, encoding: "utf8", timeout: 180_000 });
  return { status: r.status, output: `${r.stderr ?? ""}${r.stdout ?? ""}${r.error ? " " + r.error.message : ""}` };
};

const sameFile = (a: string, b: string) => { const n = (p: string) => path.resolve(p).replace(/\\/g, "/").toLowerCase(); try { return n(fs.realpathSync(a)) === n(fs.realpathSync(b)); } catch { return n(a) === n(b); } };
const revive = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object") { const o = v as Record<string, unknown>; if (typeof o.$d === "string" && Object.keys(o).length === 1) return new Date(o.$d); if (typeof o.$b === "string" && Object.keys(o).length === 1) return BigInt(o.$b); return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, revive(x)])); }
  return v;
};
const childEnv = (): NodeJS.ProcessEnv => { const e = { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1", PRISMA_GENERATE_SKIP_AUTOINSTALL: "1" } as NodeJS.ProcessEnv; for (const k of ["DATABASE_URL", "DIRECT_URL", "NANDE_SQLITE_PATH"]) delete e[k]; return e; };

export interface ReadOptions { schemaText: string; models: string[]; copyPath: string; projectDir: string; tmpBase?: string; runGenerate?: GenerateRunner; runReader?: ReaderRunner; workspaceHook?: (ws: Workspace) => void }
/** 讀取結果＋清除狀態。讀取失敗會丟錯（錯誤訊息一併附上清除狀態）；清除失敗不影響讀取結果。 */
export function readSqliteWithPrisma(o: ReadOptions): { data: SourceData; cleanup: CleanupResult; workspace: string } {
  const ws = createWorkspace(o.tmpBase);
  let result: { data?: Record<string, unknown[]>; dbFile?: string | null; error?: string } | null = null; let failure: Error | null = null;
  try {
    o.workspaceHook?.(ws);
    linkProjectPackages(ws, o.projectDir);
    const schema = toSqliteReaderSchema(o.schemaText, ws.outDir, o.copyPath);
    fs.writeFileSync(ws.schemaFile, schema); fs.writeFileSync(ws.scriptFile, READER_SCRIPT);
    const env = childEnv();
    const gen = (o.runGenerate ?? defaultRunGenerate)(ws.schemaFile, o.projectDir, env);
    if (gen.status !== 0) throw new Error("prisma generate（臨時 SQLite 讀取用 Client）失敗：" + gen.output.slice(-800));
    const run = (o.runReader ?? defaultRunReader)(ws, o.copyPath, o.models, env);
    if (!fs.existsSync(ws.resultFile)) throw new Error("讀取子程序沒有產生結果（結束碼 " + run.status + "）：" + run.output.slice(-600));
    result = JSON.parse(fs.readFileSync(ws.resultFile, "utf8"));
    if (result!.error) throw new Error("Prisma 讀取 SQLite 複本失敗：" + result!.error);
    if (run.status !== 0) throw new Error("讀取子程序異常結束（結束碼 " + run.status + "）。");
    if (!result!.dbFile || !sameFile(result!.dbFile, o.copyPath)) throw new Error("安全檢查失敗：Prisma Client 連到的不是 SQLite 複本，已停止（沒有讀取任何資料）。");
  } catch (e) { failure = e as Error; }
  const cleanup = removeWorkspace(ws.dir, o.tmpBase);
  if (failure) { failure.message += cleanup.ok ? "" : `\n（暫存資料夾未能清除：${cleanup.dir}（${cleanup.error}）。可安全手動刪除；下次執行也會自動清理。）`; throw failure; }
  const data: SourceData = new Map();
  for (const m of o.models) data.set(m, revive(result!.data![m] ?? []) as Record<string, unknown>[]);
  return { data, cleanup, workspace: ws.dir };
}

export const _test = { childEnv, sameFile, isLink, containsLink };
export const newId = () => crypto.randomBytes(4).toString("hex");
