/** SQLite／PostgreSQL 兩份 schema 的一致性比對（唯讀，只讀檔）。 */
import fs from "fs";
import path from "path";

export interface SchemaPairResult { ok: boolean; problems: string[]; models: number }

const blocks = (text: string, kind: string) => {
  const out = new Map<string, string>();
  const re = new RegExp(`^${kind}\\s+(\\w+)\\s*\\{[\\s\\S]*?^\\}`, "gm");
  for (const m of text.matchAll(re)) out.set(m[1]!, m[0].replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, ""));
  return out;
};
const withoutHeader = (text: string) => text.replace(/^(generator|datasource)\s+\w+\s*\{[\s\S]*?^\}/gm, "");

export function compareSchemaPair(sqliteText: string, pgText: string): SchemaPairResult {
  const problems: string[] = [];
  const a = blocks(sqliteText, "model"), b = blocks(pgText, "model");
  for (const k of a.keys()) if (!b.has(k)) problems.push(`PostgreSQL schema 缺少 model ${k}`);
  for (const k of b.keys()) if (!a.has(k)) problems.push(`PostgreSQL schema 多出 model ${k}`);
  for (const [k, v] of a) if (b.has(k) && b.get(k) !== v) problems.push(`model ${k} 的定義在兩份 schema 不一致`);
  for (const kind of ["enum", "view", "type"]) {
    const x = blocks(sqliteText, kind), y = blocks(pgText, kind);
    if (x.size !== y.size || [...x].some(([k, v]) => y.get(k) !== v)) problems.push(`${kind} 區塊不一致`);
  }
  // 其餘非 model 的頂層內容（例如新增的區塊）也不能只在其中一份出現
  const strip = (t: string) => Array.from(blocks(withoutHeader(t), "\\w+")).length;
  if (strip(sqliteText) !== strip(pgText)) problems.push("頂層區塊數量不一致");
  const nc = (t: string) => t.replace(/\/\/.*$/gm, "");
  const sq = /datasource\s+\w+\s*\{[^}]*?provider\s*=\s*"([^"]+)"/.exec(nc(sqliteText))?.[1];
  const pg = /datasource\s+\w+\s*\{[^}]*?provider\s*=\s*"([^"]+)"/.exec(nc(pgText))?.[1];
  if (sq !== "sqlite") problems.push(`schema.prisma 的 provider 應為 sqlite（目前 ${sq}）`);
  if (pg !== "postgresql") problems.push(`schema.postgres.prisma 的 provider 應為 postgresql（目前 ${pg}）`);
  if (!/binaryTargets\s*=\s*\[[^\]]*"rhel-openssl-3\.0\.x"/.test(nc(pgText))) problems.push("schema.postgres.prisma 缺少 binaryTargets 的 rhel-openssl-3.0.x（Vercel 需要）");
  if (!/directUrl\s*=\s*env\("DIRECT_URL"\)/.test(nc(pgText))) problems.push("schema.postgres.prisma 缺少 directUrl = env(\"DIRECT_URL\")");
  if (/@db\./.test(nc(sqliteText)) || /@db\./.test(nc(pgText))) problems.push("偵測到 @db.* 原生型別屬性：兩種資料庫行為可能不同，請先評估");
  return { ok: problems.length === 0, problems, models: a.size };
}

export function compareSchemaFiles(projectDir: string): SchemaPairResult | null {
  const p = path.join(projectDir, "prisma", "schema.postgres.prisma");
  if (!fs.existsSync(p)) return null;
  return compareSchemaPair(fs.readFileSync(path.join(projectDir, "prisma", "schema.prisma"), "utf8"), fs.readFileSync(p, "utf8"));
}
