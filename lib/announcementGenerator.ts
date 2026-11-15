import { GeneratedAnnouncement, LangCode, CalendarEvent } from "@/lib/types";
import { calendarEvents } from "@/lib/data/mockCalendar";
import { drillNotice2026 } from "@/lib/data/drillNotice";

type DrillNoticeShape = typeof drillNotice2026;

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const weekdayZh = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(dateISO: string, lang: LangCode) {
  const d = new Date(dateISO + "T00:00:00");
  if (lang === "zh-TW") {
    return `${d.getMonth() + 1}/${d.getDate()}（${weekdayZh[d.getDay()]}）`;
  }
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Anchor events of the given holiday-ness that are 1–3 days away, nearest first. */
function findUpcomingAnchors(todayISO: string, wantHoliday: boolean, events: CalendarEvent[]) {
  return events
    .filter((e) => e.isAnchor && e.isHoliday === wantHoliday)
    .map((e) => ({ event: e, diff: daysBetween(todayISO, e.date) }))
    .filter((c) => c.diff >= 1 && c.diff <= 3)
    .sort((a, b) => a.diff - b.diff || a.event.id.localeCompare(b.event.id));
}

/** Any events (anchor or not) that fall exactly on today. */
function findToday(todayISO: string, events: CalendarEvent[]) {
  return events.filter((e) => e.date === todayISO);
}

/**
 * 首頁「行事曆連動」公告（依序，第一筆就是最適合放在輪播第一頁的）。
 *
 * 排序依據（高 → 低）：
 *   0. 今天就是節日／紀念日（一個事件一則，節日優先於紀念日）
 *   1. 1～3 天內的節日（越近越前面）
 *   2. 7、8 月的防空演習提醒
 *   3. 1～3 天內的紀念日（越近越前面）
 * 每個行事曆事件最多產生一則（以事件 id 去重），不會把所有事件都變成公告；
 * 沒有任何符合條件的事件時回傳 []，由呼叫端退回一般公告。
 */
export function generateHomeAnnouncements(
  today: Date = new Date(),
  events: CalendarEvent[] = calendarEvents,
  drillNotice: DrillNoticeShape = drillNotice2026
): GeneratedAnnouncement[] {
  const todayISO = toISODate(today);
  const month = today.getMonth() + 1;
  const out: GeneratedAnnouncement[] = [];
  const seenEvents = new Set<string>();

  // Tier 0 — today itself is a holiday or the memorial day: say so plainly.
  const todays = findToday(todayISO, events).sort((a, b) => Number(b.isHoliday) - Number(a.isHoliday));
  for (const ev of todays) {
    if (seenEvents.has(ev.id)) continue;
    seenEvents.add(ev.id);
    const label = ev.groupLabel ?? ev.name;
    if (ev.isHoliday) {
      out.push({
        id: `today-${ev.id}`,
        kind: "holiday",
        title: { "zh-TW": `今天是${label["zh-TW"]}`, en: `Today is ${label.en}` },
        body: {
          "zh-TW": `${formatDate(ev.date, "zh-TW")} ${label["zh-TW"]}，祝你假期愉快！`,
          en: `${formatDate(ev.date, "en")} — enjoy the ${label.en} holiday!`,
        },
      });
    } else {
      out.push({
        id: `today-${ev.id}`,
        kind: "memorial",
        title: { "zh-TW": `今天是${label["zh-TW"]}`, en: `Today is ${label.en}` },
        body: ev.description,
      });
    }
  }

  // Tier 1 — upcoming holidays within the next 3 days.
  for (const { event } of findUpcomingAnchors(todayISO, true, events)) {
    if (seenEvents.has(event.id)) continue;
    seenEvents.add(event.id);
    const label = event.groupLabel ?? event.name;
    out.push({
      id: `upcoming-${event.id}`,
      kind: "holiday",
      title: { "zh-TW": `${label["zh-TW"]}即將到來`, en: `${label.en} is coming up` },
      body: {
        "zh-TW": `${formatDate(event.date, "zh-TW")} ${label["zh-TW"]}放假，別忘了提前安排行程！`,
        en: `${formatDate(event.date, "en")} is ${label.en} — a day off. Plan ahead!`,
      },
    });
  }

  // Tier 2 — drill season (July/August), using verified official dates.
  if (month === 7 || month === 8) {
    const inConfirmedWindow = todayISO >= drillNotice.start && todayISO <= drillNotice.end;
    out.push({
      id: "drill-notice",
      kind: "drill",
      title: drillNotice.title,
      body: inConfirmedWindow ? drillNotice.body : drillNotice.generalBody,
    });
  }

  // Tier 3 — upcoming memorial days (e.g. 9/21) within the next 3 days.
  for (const { event } of findUpcomingAnchors(todayISO, false, events)) {
    if (seenEvents.has(event.id)) continue;
    seenEvents.add(event.id);
    const label = event.groupLabel ?? event.name;
    out.push({
      id: `upcoming-${event.id}`,
      kind: "memorial",
      title: { "zh-TW": `${label["zh-TW"]}即將到來`, en: `${label.en} is coming up` },
      body: {
        "zh-TW": `${formatDate(event.date, "zh-TW")}為${label["zh-TW"]}，非放假日。`,
        en: `${formatDate(event.date, "en")} is ${label.en} — not a day off.`,
      },
    });
  }

  // 沒有 Tier 4：原本寫死的推廣文字已搬進 Announcement 資料表（可在後台編輯），
  // 這裡不再重複輸出，避免同一內容出現兩次。
  return out;
}

/**
 * 首頁輪播的最終順序：行事曆連動公告一律在前（第一頁），一般公告（後台）依原本順序接在後面。
 * 沒有任何行事曆連動公告時，結果就是原本的一般公告順序。
 * 不刪除、不複製任何一則公告。
 */
export function orderHomeAnnouncements(
  calendarLinked: GeneratedAnnouncement[],
  general: GeneratedAnnouncement[]
): GeneratedAnnouncement[] {
  const seen = new Set<string>();
  const out: GeneratedAnnouncement[] = [];
  for (const a of [...calendarLinked, ...general]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

/** 以台灣時區（Asia/Taipei）的「今天」建立 Date，供伺服器端先算出首頁第一頁，避免重新整理時先閃出一般公告。 */
export function taipeiToday(now: Date = new Date()): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}
