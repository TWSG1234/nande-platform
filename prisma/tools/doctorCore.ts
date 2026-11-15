/**
 * 資料庫診斷核心（唯讀）：只做 SELECT / PRAGMA，不寫入、不刪除、不建立檔案。
 * 與資料庫連線方式無關——由呼叫端提供 query()，所以 Prisma 與測試用的 SQLite 都能用。
 */
import { readFileSync } from "fs";

export type Query = (sql: string) => Promise<Record<string, unknown>[]>;

export interface ExpectedTable {
  name: string;
  columns: string[];
}

/** 從 schema.prisma 文字解析出「資料庫應該有的資料表與欄位」（略過關聯欄位）。 */
export function parseSchema(text: string): ExpectedTable[] {
  const modelNames = [...text.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]!);
  const names = new Set(modelNames);
  const tables: ExpectedTable[] = [];
  for (const m of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const columns: string[] = [];
    for (const raw of m[2]!.split("\n")) {
      const line = raw.split("//")[0]!.trim();
      if (!line || line.startsWith("@@")) continue;
      const [name, type] = line.split(/\s+/);
      if (!name || !type) continue;
      const base = type.replace(/[?\[\]]/g, "");
      if (type.endsWith("[]") || names.has(base)) continue; // 關聯欄位，不是實際欄位
      columns.push(name);
    }
    tables.push({ name: m[1]!, columns });
  }
  return tables;
}

export function parseSchemaFile(path: string) {
  return parseSchema(readFileSync(path, "utf-8"));
}

const num = (v: unknown) => Number(v ?? 0);

export interface DoctorReport {
  lines: string[];
  missingTables: string[];
  missingColumns: { table: string; columns: string[] }[];
}

export async function runDoctor(query: Query, expected: ExpectedTable[]): Promise<DoctorReport> {
  const lines: string[] = [];
  const log = (s = "") => lines.push(s);

  const existingTables = new Set((await query(`SELECT name FROM sqlite_master WHERE type='table'`)).map((r) => String(r.name)));
  const columnsOf: Record<string, Set<string>> = {};
  for (const t of expected) {
    if (!existingTables.has(t.name)) continue;
    columnsOf[t.name] = new Set((await query(`PRAGMA table_info("${t.name}")`)).map((r) => String(r.name)));
  }

  const missingTables = expected.filter((t) => !existingTables.has(t.name)).map((t) => t.name);
  const missingColumns = expected
    .filter((t) => columnsOf[t.name])
    .map((t) => ({ table: t.name, columns: t.columns.filter((c) => !columnsOf[t.name]!.has(c)) }))
    .filter((x) => x.columns.length > 0);

  log("【一、資料庫結構 vs 目前程式（schema.prisma）】");
  if (missingTables.length === 0 && missingColumns.length === 0) {
    log("  ✅ 資料表與欄位都齊全。");
  } else {
    if (missingTables.length) log(`  ❌ 缺少的資料表（${missingTables.length}）：${missingTables.join("、")}`);
    for (const m of missingColumns) log(`  ❌ ${m.table} 缺少欄位：${m.columns.join("、")}`);
    log("  → 程式讀取這些資料時會出錯；而網站為了不當機，會「靜默」改顯示空白或內建範例資料，");
    log("    看起來就像功能或內容消失了（資料本身通常還在，只是讀不出來）。");
  }

  // ── 內容盤點：只在資料表與所需欄位都存在時才查 ──────────────────────────
  const has = (t: string, cols: string[] = []) => !!columnsOf[t] && cols.every((c) => columnsOf[t]!.has(c));
  const safe = async (title: string, fn: () => Promise<string>) => {
    try {
      log(`  ${title}：${await fn()}`);
    } catch (e) {
      log(`  ${title}：⚠ 查詢失敗（${(e as Error).message.split("\n")[0]}）`);
    }
  };
  const count = async (sql: string) => num((await query(sql))[0]?.n);
  const group = async (sql: string) => (await query(sql)).map((r) => `${r.k}=${r.n}`).join("、") || "（無）";

  log("");
  log("【二、目前資料庫裡實際有多少內容】");
  const skip = (t: string) => log(`  ${t}：（資料表不存在或欄位不全，無法統計）`);

  if (has("ChineseStage", ["track", "isPublished"])) {
    await safe("中文學習 關卡（生活/校園）", async () => `${await group(`SELECT track k, COUNT(*) n FROM ChineseStage GROUP BY track`)}；已發布 ${await count(`SELECT COUNT(*) n FROM ChineseStage WHERE isPublished=1`)}`);
    await safe("　└ 已命名的關卡", async () => `${await group(`SELECT track k, COUNT(*) n FROM ChineseStage WHERE titleZh<>'' GROUP BY track`)}`);
  } else skip("中文學習 關卡");
  if (has("ChinesePage", ["type"])) {
    await safe("中文學習 頁面（依類型）", () => group(`SELECT type k, COUNT(*) n FROM ChinesePage GROUP BY type`));
    if (has("ChinesePage", ["comicImages", "comicImagesEn"]))
      await safe("　└ 有中文漫畫圖的頁面／有英文漫畫圖的頁面", async () => `${await count(`SELECT COUNT(*) n FROM ChinesePage WHERE type='comic' AND comicImages IS NOT NULL AND comicImages NOT IN ('','[]')`)} ／ ${await count(`SELECT COUNT(*) n FROM ChinesePage WHERE type='comic' AND comicImagesEn IS NOT NULL AND comicImagesEn NOT IN ('','[]')`)}`);
  } else skip("中文學習 頁面");
  if (has("ChineseVocabWord")) await safe("中文學習 單字總數", async () => String(await count(`SELECT COUNT(*) n FROM ChineseVocabWord`)));
  else skip("中文學習 單字");
  if (has("ChineseQuestion", ["questionType"])) await safe("中文學習 題目（依類型）", () => group(`SELECT questionType k, COUNT(*) n FROM ChineseQuestion GROUP BY questionType`));
  else skip("中文學習 題目");
  if (has("ChineseLevel")) await safe("舊版中文關卡（ChineseLevel，網址 /chinese/[分類]/[關卡] 使用）", async () => String(await count(`SELECT COUNT(*) n FROM ChineseLevel`)));

  if (has("Announcement", ["type", "isPublished"])) await safe("首頁公告（依類型，含未發布）", async () => `${await group(`SELECT type k, COUNT(*) n FROM Announcement GROUP BY type`)}；已發布 ${await count(`SELECT COUNT(*) n FROM Announcement WHERE isPublished=1`)}`);
  else skip("首頁公告");
  if (has("CalendarEvent", ["isPublished", "isAnchor"])) await safe("台灣行事曆事件", async () => `共 ${await count(`SELECT COUNT(*) n FROM CalendarEvent`)}，已發布 ${await count(`SELECT COUNT(*) n FROM CalendarEvent WHERE isPublished=1`)}，錨點（會觸發首頁自動提醒）${await count(`SELECT COUNT(*) n FROM CalendarEvent WHERE isAnchor=1`)}`);
  else skip("台灣行事曆事件");
  if (has("CampusSpot")) await safe("校園座標項目", async () => String(await count(`SELECT COUNT(*) n FROM CampusSpot`)));
  if (has("CampusSpot", ["schoolTimes"])) await safe("　└ 有填「各校時間」的項目", async () => String(await count(`SELECT COUNT(*) n FROM CampusSpot WHERE schoolTimes IS NOT NULL AND schoolTimes NOT IN ('','[]')`)));
  if (has("LifeCategory")) await safe("生活座標 分類／項目", async () => `${await count(`SELECT COUNT(*) n FROM LifeCategory`)} ／ ${has("LifeItem") ? await count(`SELECT COUNT(*) n FROM LifeItem`) : "?"}`);
  if (has("PhotoSubmission", ["status"])) await safe("照片牆投稿（依狀態）", () => group(`SELECT status k, COUNT(*) n FROM PhotoSubmission GROUP BY status`));
  if (has("Comment")) await safe("留言", async () => String(await count(`SELECT COUNT(*) n FROM Comment`)));
  if (has("IpCharacter")) await safe("IP 角色", async () => String(await count(`SELECT COUNT(*) n FROM IpCharacter`)));
  if (has("IpCharacter", ["homePosition"])) await safe("　└ 已設定「首頁位置」的角色", async () => String(await count(`SELECT COUNT(*) n FROM IpCharacter WHERE homePosition IS NOT NULL AND homePosition<>''`)));
  if (has("IpDialogueLine")) await safe("　└ 首頁對話句數", async () => String(await count(`SELECT COUNT(*) n FROM IpDialogueLine`)));
  else if (has("IpCharacter")) log("  　└ 首頁對話句數：IpDialogueLine 資料表不存在");
  for (const [t, label] of [["AboutContent", "關於我們 主內容"], ["AboutSection", "關於我們 區塊"], ["TeamMember", "團隊成員"], ["Partner", "合作單位"], ["AssistantSetting", "威洛小助理 設定"], ["AssistantRule", "威洛小助理 規則"]] as const) {
    if (has(t)) await safe(label, async () => String(await count(`SELECT COUNT(*) n FROM ${t}`)));
    else log(`  ${label}：資料表不存在`);
  }

  log("");
  log("【三、判讀】");
  if (missingTables.length || missingColumns.length) {
    log("  ① 先備份：npm run db:backup");
    log("  ② 再補齊結構（只新增資料表／欄位，不會刪除或清空資料）：npx prisma db push");
    log("     ※ 若出現要「reset / 清除資料」的提示或 --accept-data-loss，請不要同意，先停下來把畫面貼給我。");
    log("     ※ 不要執行 prisma migrate reset。");
    log("  ③ 補完後重啟網站；若某區塊的內容數量是 0（例如生活單字），再用對應的匯入指令補入（見操作說明）。");
  } else {
    log("  結構正常。若某區塊在網站上仍看不到內容，請看上面「二」的數量：");
    log("  - 數量為 0 → 資料沒有被匯入（不是被刪除），需要執行對應的匯入／seed 指令。");
    log("  - 數量不為 0 但網站沒顯示 → 看 npm run dev 終端機是否有 [serverData] … fell back 的錯誤訊息。");
  }
  return { lines, missingTables, missingColumns };
}
