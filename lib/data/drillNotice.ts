import { Localized } from "@/lib/types";

/**
 * ════════════════════════════════════════════════════════════════════════
 * DATA SOURCE — 2026年防空／軍事演習期程
 * ════════════════════════════════════════════════════════════════════════
 * 2026城鎮韌性（防空）演習（原「萬安演習」，2025年起更名）：國防部全民防衛動員署
 * 公布之「2026城鎮韌性（防空）演習期程規劃表」，全台22縣市分5區異時實施，
 * 8/7–8/13 期間各區輪流進行30分鐘演練（多數為 13:30–14:00，南部場次為
 * 10:00–10:30）。
 *
 * 漢光42號演習（國軍年度實兵操演）：電腦兵棋推演 4/10–4/24；實兵操演
 * 8/5–8/14，與城鎮韌性演習同步辦理。
 *
 * These are this year's confirmed dates — verify against the Ministry of
 * National Defense (國防部) and All-out Defense Mobilization Agency
 * (全民防衛動員署) before reusing for a future year, since the schedule
 * shifts annually.
 * ════════════════════════════════════════════════════════════════════════
 */
export const drillNotice2026 = {
  /** The specific window with confirmed official dates. */
  start: "2026-08-05",
  end: "2026-08-14",
  title: {
    "zh-TW": "演習提醒",
    en: "Drill Reminder",
  },
  body: {
    "zh-TW":
      "8/5～8/14 為漢光42號演習期間，其中 8/7～8/13 各地將分區實施城鎮韌性（防空）演習，期間可能有警報測試、人車管制，請留意官方公告與所在地區時段。",
    en: "Aug 5–14 is the Han Kuang No. 42 exercise period, with the City Resilience (air defense) drill held region-by-region across Aug 7–13 — expect alarm tests and brief traffic/pedestrian control. Please follow official announcements for your area's exact time slot.",
  },
  /**
   * Shown for the rest of July/August when today is outside the confirmed
   * window above — and also reused as-is by the Calendar page's month-view
   * banner (components/CalendarContent.tsx), which only checks the VIEWED
   * month (7 or 8), not the exact date, per this feature's "keep it general,
   * don't cite specifics you haven't verified for the viewed date" scope.
   */
  generalBody: {
    "zh-TW": "7、8 月為台灣演習與防災宣導較密集的時期，請留意學校及官方公告。",
    en: "July and August are Taiwan's busiest months for civil-defense drills and preparedness campaigns — please keep an eye on notices from your school and official announcements.",
  },
} satisfies {
  start: string;
  end: string;
  title: Localized;
  body: Localized;
  generalBody: Localized;
};
