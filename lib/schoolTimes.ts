// 各校時間（升旗、午休）在後台用「一行一間學校」的文字輸入：
//   屏東縣屏榮高級中學｜7:45～8:00
// 存進資料庫時轉成 JSON 陣列 [{ school, time }]。
export type SchoolTime = { school: string; time: string };

export function parseSchoolTimesText(text: string | undefined | null): SchoolTime[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [school, ...rest] = line.split(/[｜|]/);
      return { school: (school ?? "").trim(), time: rest.join("｜").trim() };
    })
    .filter((st) => st.school && st.time);
}

export function schoolTimesToText(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const arr = JSON.parse(json) as SchoolTime[];
    return arr.map((st) => `${st.school}｜${st.time}`).join("\n");
  } catch {
    return "";
  }
}
