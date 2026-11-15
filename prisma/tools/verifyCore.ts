/** 備份／資料庫檔案的唯讀檢查核心：完整性 + 主要資料表筆數。與連線方式無關（由呼叫端提供 query）。 */
export type Query = (sql: string) => Promise<Record<string, unknown>[]>;

export const KEY_TABLES = [
  "Announcement", "CalendarEvent", "CampusSpot", "LifeCategory", "LifeItem",
  "ChineseStage", "ChinesePage", "ChineseVocabWord", "ChineseQuestion",
  "IpCharacter", "SiteSetting", "Admin",
];

export interface VerifyResult {
  ok: boolean;
  integrity: string;
  counts: Record<string, number | null>;
  lines: string[];
}

export async function verifyDatabase(query: Query): Promise<VerifyResult> {
  const lines: string[] = [];
  let integrity = "";
  try {
    integrity = String(Object.values((await query("PRAGMA integrity_check"))[0] ?? {})[0] ?? "");
  } catch (e) {
    return { ok: false, integrity: "", counts: {}, lines: [`❌ 無法讀取：${(e as Error).message.split("\n")[0]}`] };
  }
  const tables = new Set((await query(`SELECT name FROM sqlite_master WHERE type='table'`)).map((r) => String(r.name)));
  const counts: Record<string, number | null> = {};
  for (const t of KEY_TABLES) {
    counts[t] = tables.has(t) ? Number((await query(`SELECT COUNT(*) AS n FROM "${t}"`))[0]?.n ?? 0) : null;
  }
  const ok = integrity === "ok" && tables.size > 0;
  lines.push(ok ? "✅ 資料庫結構完整（integrity_check: ok）" : `❌ integrity_check：${integrity || "無結果"}`);
  lines.push("主要資料筆數：" + KEY_TABLES.map((t) => `${t}=${counts[t] ?? "（無此表）"}`).join("、"));
  return { ok, integrity, counts, lines };
}
