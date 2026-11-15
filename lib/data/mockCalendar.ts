import { CalendarEvent } from "@/lib/types";

/**
 * ════════════════════════════════════════════════════════════════════════
 * DATA SOURCE — 中華民國115年（西元2026年）行事曆
 * ════════════════════════════════════════════════════════════════════════
 * Fixed national holidays and their 補假 (day-in-lieu) dates: 行政院人事行政總處
 * 「中華民國115年（西元2026年）政府行政機關辦公日曆表」(published 2025-06-13),
 * https://www.dgpa.gov.tw/information?uid=30 — cross-checked against the
 * "紀念日及節日實施條例" makeup-day rule (Sat → preceding workday, Sun → following
 * workday) and multiple independent 2026 calendar summaries.
 *
 * 921 國家防災日 (National Disaster Prevention Day, commemorating the 1999
 * Chi-Chi earthquake): 內政部消防署 / established by the Executive Yuan in 2000.
 * It is explicitly NOT a public holiday — offices and schools operate normally.
 *
 * This file intentionally contains ONLY fixed-date national holidays and this
 * one nationally-significant memorial day. School-specific items (exam weeks,
 * semester start, orientation, etc.) do not have government-fixed dates and
 * have been removed — see the platform's change log.
 *
 * `origin` / `taiwanCustoms` / `source` (added for the holiday-info modal
 * upgrade) were written after checking: 228, Retrocession Day, Teachers' Day,
 * Constitution Day, and 921 against news coverage that itself cites 行政院,
 * 內政部消防署, 國史館臺灣文獻館, and Wikipedia's zh "和平紀念日 (臺灣)" /
 * "臺灣光復節" / "教師節" / "行憲紀念日" articles (used only to cross-check
 * dates/sequence of events, not as the cited source itself). Folk legends
 * (Qu Yuan, Chang'e, the Nian beast) are explicitly labeled as legend, not
 * fact, per the platform's content policy. Traditional-festival customs
 * (Lunar New Year, Qingming, Dragon Boat, Mid-Autumn) draw on the Ministry
 * of Education's Taiwan Minnan/Hakka reference dictionaries and the Tourism
 * Administration's culture pages. Where no well-attested custom exists for a
 * date (e.g. 228, Retrocession Day, Constitution Day), `taiwanCustoms` is
 * left out rather than padded with invented content.
 *
 * To update for a new year: replace this file's contents once DGPA publishes
 * the next year's 辦公日曆表 (typically by June 30 of the preceding year).
 * ════════════════════════════════════════════════════════════════════════
 */
export const calendarEvents: CalendarEvent[] = [
  {
    id: "h-newyear",
    date: "2026-01-01",
    name: { "zh-TW": "元旦", en: "New Year's Day" },
    isHoliday: true,
    description: {
      "zh-TW": "跨年後的第一天，是中華民國的國定假日，也是許多人展開新年計畫的起點。",
      en: "The first day of the new year and a public holiday in Taiwan — many people mark it with resolutions or a short trip.",
    },
    origin: {
      "zh-TW": "1912年1月1日，中華民國政府正式成立，因此這一天兼具「中華民國開國紀念日」與陽曆新年的雙重意義。",
      en: "January 1, 1912 was the day the Republic of China's government was formally established — which is why this date doubles as the ROC's official \"Founding Day\" alongside the start of the solar calendar year.",
    },
    taiwanCustoms: [
      { "zh-TW": "跨年倒數與煙火（如台北101）", en: "Countdown celebrations and fireworks (e.g. at Taipei 101)" },
      { "zh-TW": "總統府前的元旦升旗典禮", en: "A New Year's Day flag-raising ceremony in front of the Presidential Office" },
    ],
    source: { "zh-TW": "行政院人事行政總處", en: "Directorate-General of Personnel Administration, Executive Yuan" },
    isAnchor: true,
    groupLabel: { "zh-TW": "元旦", en: "New Year's Day" },
  },

  {
    id: "h-cny-eve-eve",
    date: "2026-02-15",
    name: { "zh-TW": "小年夜", en: "Lunar NY Eve Eve" },
    isHoliday: true,
    description: {
      "zh-TW": "農曆除夕前一天，家家戶戶開始準備年菜、大掃除，迎接農曆新年。自2026年起列為法定假日。",
      en: "The day before Lunar New Year's Eve — households prepare festive food and clean the home ahead of the new year. A statutory holiday starting in 2026.",
    },
    origin: {
      "zh-TW":
        "農曆新年是華人社會最重要的傳統節慶，源自慶祝辭舊迎新、祈求來年豐收平安的古老習俗。民間流傳最廣的說法之一，是古代有一種叫「年」的猛獸，會在除夕夜出沒傷人，人們用紅色、燈火與鞭炮聲把牠嚇跑，才逐漸演變出貼紅春聯、放鞭炮等習俗——這是廣為流傳的民間傳說，並非確切的歷史紀錄。",
      en: "Lunar New Year is the most important traditional festival in Chinese culture, rooted in customs of bidding farewell to the old year and welcoming the new one with hopes for a good harvest and safety ahead. A widely told folk legend says an ancient beast called \"Nian\" would appear on New Year's Eve to harm people, and villagers used the color red, fire, and firecracker noise to scare it away — said to be the origin of red couplets and firecrackers. This is a popular folk story, not a documented historical record.",
    },
    taiwanCustoms: [
      { "zh-TW": "除夕圍爐吃年夜飯", en: "A reunion dinner on Lunar New Year's Eve" },
      { "zh-TW": "長輩發放紅包", en: "Elders giving out red envelopes (hongbao)" },
      { "zh-TW": "貼春聯、掛燈籠", en: "Displaying spring couplets and lanterns" },
      { "zh-TW": "初一、初二走春拜年", en: "Visiting relatives to exchange New Year greetings" },
    ],
    source: { "zh-TW": "行政院人事行政總處", en: "Directorate-General of Personnel Administration, Executive Yuan" },
    isAnchor: true,
    groupLabel: { "zh-TW": "農曆新年", en: "Lunar New Year" },
  },
  {
    id: "h-cny-eve",
    date: "2026-02-16",
    name: { "zh-TW": "除夕", en: "Lunar NY Eve" },
    isHoliday: true,
    description: {
      "zh-TW": "農曆新年前一晚，家人團聚圍爐吃年夜飯，是台灣最重要的節日之一。",
      en: "Lunar New Year's Eve — families gather for a reunion dinner, one of the most important nights of the year in Taiwan.",
    },
    origin: {
      "zh-TW":
        "農曆新年是華人社會最重要的傳統節慶，源自慶祝辭舊迎新、祈求來年豐收平安的古老習俗。民間流傳最廣的說法之一，是古代有一種叫「年」的猛獸，會在除夕夜出沒傷人，人們用紅色、燈火與鞭炮聲把牠嚇跑，才逐漸演變出貼紅春聯、放鞭炮等習俗——這是廣為流傳的民間傳說，並非確切的歷史紀錄。",
      en: "Lunar New Year is the most important traditional festival in Chinese culture, rooted in customs of bidding farewell to the old year and welcoming the new one with hopes for a good harvest and safety ahead. A widely told folk legend says an ancient beast called \"Nian\" would appear on New Year's Eve to harm people, and villagers used the color red, fire, and firecracker noise to scare it away — said to be the origin of red couplets and firecrackers. This is a popular folk story, not a documented historical record.",
    },
    taiwanCustoms: [
      { "zh-TW": "除夕圍爐吃年夜飯", en: "A reunion dinner on Lunar New Year's Eve" },
      { "zh-TW": "長輩發放紅包", en: "Elders giving out red envelopes (hongbao)" },
      { "zh-TW": "貼春聯、掛燈籠", en: "Displaying spring couplets and lanterns" },
      { "zh-TW": "初一、初二走春拜年", en: "Visiting relatives to exchange New Year greetings" },
    ],
    source: { "zh-TW": "行政院人事行政總處", en: "Directorate-General of Personnel Administration, Executive Yuan" },
  },
  {
    id: "h-cny-1",
    date: "2026-02-17",
    name: { "zh-TW": "春節初一", en: "Lunar NY Day 1" },
    isHoliday: true,
    description: {
      "zh-TW": "農曆新年的第一天，親友互相拜年，長輩會給晚輩紅包。",
      en: "The first day of Lunar New Year — people visit relatives to exchange greetings, and elders give red envelopes to children.",
    },
    origin: {
      "zh-TW":
        "農曆新年是華人社會最重要的傳統節慶，源自慶祝辭舊迎新、祈求來年豐收平安的古老習俗。民間流傳最廣的說法之一，是古代有一種叫「年」的猛獸，會在除夕夜出沒傷人，人們用紅色、燈火與鞭炮聲把牠嚇跑，才逐漸演變出貼紅春聯、放鞭炮等習俗——這是廣為流傳的民間傳說，並非確切的歷史紀錄。",
      en: "Lunar New Year is the most important traditional festival in Chinese culture, rooted in customs of bidding farewell to the old year and welcoming the new one with hopes for a good harvest and safety ahead. A widely told folk legend says an ancient beast called \"Nian\" would appear on New Year's Eve to harm people, and villagers used the color red, fire, and firecracker noise to scare it away — said to be the origin of red couplets and firecrackers. This is a popular folk story, not a documented historical record.",
    },
    taiwanCustoms: [
      { "zh-TW": "除夕圍爐吃年夜飯", en: "A reunion dinner on Lunar New Year's Eve" },
      { "zh-TW": "長輩發放紅包", en: "Elders giving out red envelopes (hongbao)" },
      { "zh-TW": "貼春聯、掛燈籠", en: "Displaying spring couplets and lanterns" },
      { "zh-TW": "初一、初二走春拜年", en: "Visiting relatives to exchange New Year greetings" },
    ],
    source: { "zh-TW": "行政院人事行政總處", en: "Directorate-General of Personnel Administration, Executive Yuan" },
  },
  {
    id: "h-cny-2",
    date: "2026-02-18",
    name: { "zh-TW": "春節初二", en: "Lunar NY Day 2" },
    isHoliday: true,
    description: {
      "zh-TW": "傳統上是已婚女兒回娘家的日子。",
      en: "Traditionally the day married daughters visit their own parents' families.",
    },
    origin: {
      "zh-TW":
        "農曆新年是華人社會最重要的傳統節慶，源自慶祝辭舊迎新、祈求來年豐收平安的古老習俗。民間流傳最廣的說法之一，是古代有一種叫「年」的猛獸，會在除夕夜出沒傷人，人們用紅色、燈火與鞭炮聲把牠嚇跑，才逐漸演變出貼紅春聯、放鞭炮等習俗——這是廣為流傳的民間傳說，並非確切的歷史紀錄。",
      en: "Lunar New Year is the most important traditional festival in Chinese culture, rooted in customs of bidding farewell to the old year and welcoming the new one with hopes for a good harvest and safety ahead. A widely told folk legend says an ancient beast called \"Nian\" would appear on New Year's Eve to harm people, and villagers used the color red, fire, and firecracker noise to scare it away — said to be the origin of red couplets and firecrackers. This is a popular folk story, not a documented historical record.",
    },
    taiwanCustoms: [
      { "zh-TW": "除夕圍爐吃年夜飯", en: "A reunion dinner on Lunar New Year's Eve" },
      { "zh-TW": "長輩發放紅包", en: "Elders giving out red envelopes (hongbao)" },
      { "zh-TW": "貼春聯、掛燈籠", en: "Displaying spring couplets and lanterns" },
      { "zh-TW": "初一、初二走春拜年", en: "Visiting relatives to exchange New Year greetings" },
    ],
    source: { "zh-TW": "行政院人事行政總處", en: "Directorate-General of Personnel Administration, Executive Yuan" },
  },
  {
    id: "h-cny-3",
    date: "2026-02-19",
    name: { "zh-TW": "春節初三", en: "Lunar NY Day 3" },
    isHoliday: true,
    description: {
      "zh-TW": "春節連假的最後一天，許多人仍在走春、拜訪親友。",
      en: "The last day of the main Lunar New Year holiday — many people are still visiting relatives and temples.",
    },
    origin: {
      "zh-TW":
        "農曆新年是華人社會最重要的傳統節慶，源自慶祝辭舊迎新、祈求來年豐收平安的古老習俗。民間流傳最廣的說法之一，是古代有一種叫「年」的猛獸，會在除夕夜出沒傷人，人們用紅色、燈火與鞭炮聲把牠嚇跑，才逐漸演變出貼紅春聯、放鞭炮等習俗——這是廣為流傳的民間傳說，並非確切的歷史紀錄。",
      en: "Lunar New Year is the most important traditional festival in Chinese culture, rooted in customs of bidding farewell to the old year and welcoming the new one with hopes for a good harvest and safety ahead. A widely told folk legend says an ancient beast called \"Nian\" would appear on New Year's Eve to harm people, and villagers used the color red, fire, and firecracker noise to scare it away — said to be the origin of red couplets and firecrackers. This is a popular folk story, not a documented historical record.",
    },
    taiwanCustoms: [
      { "zh-TW": "除夕圍爐吃年夜飯", en: "A reunion dinner on Lunar New Year's Eve" },
      { "zh-TW": "長輩發放紅包", en: "Elders giving out red envelopes (hongbao)" },
      { "zh-TW": "貼春聯、掛燈籠", en: "Displaying spring couplets and lanterns" },
      { "zh-TW": "初一、初二走春拜年", en: "Visiting relatives to exchange New Year greetings" },
    ],
    source: { "zh-TW": "行政院人事行政總處", en: "Directorate-General of Personnel Administration, Executive Yuan" },
  },
  {
    id: "h-cny-eve-eve-makeup",
    date: "2026-02-20",
    name: { "zh-TW": "小年夜補假", en: "Day Off (in lieu)" },
    isHoliday: true,
    isMakeup: true,
    description: {
      "zh-TW": "因小年夜（2/15）適逢星期日而調整的補假日。",
      en: "A day off in lieu, since Little New Year's Eve (2/15) fell on a Sunday.",
    },
    origin: {
      "zh-TW":
        "農曆新年是華人社會最重要的傳統節慶，源自慶祝辭舊迎新、祈求來年豐收平安的古老習俗。民間流傳最廣的說法之一，是古代有一種叫「年」的猛獸，會在除夕夜出沒傷人，人們用紅色、燈火與鞭炮聲把牠嚇跑，才逐漸演變出貼紅春聯、放鞭炮等習俗——這是廣為流傳的民間傳說，並非確切的歷史紀錄。",
      en: "Lunar New Year is the most important traditional festival in Chinese culture, rooted in customs of bidding farewell to the old year and welcoming the new one with hopes for a good harvest and safety ahead. A widely told folk legend says an ancient beast called \"Nian\" would appear on New Year's Eve to harm people, and villagers used the color red, fire, and firecracker noise to scare it away — said to be the origin of red couplets and firecrackers. This is a popular folk story, not a documented historical record.",
    },
    taiwanCustoms: [
      { "zh-TW": "除夕圍爐吃年夜飯", en: "A reunion dinner on Lunar New Year's Eve" },
      { "zh-TW": "長輩發放紅包", en: "Elders giving out red envelopes (hongbao)" },
      { "zh-TW": "貼春聯、掛燈籠", en: "Displaying spring couplets and lanterns" },
      { "zh-TW": "初一、初二走春拜年", en: "Visiting relatives to exchange New Year greetings" },
    ],
    source: { "zh-TW": "行政院人事行政總處", en: "Directorate-General of Personnel Administration, Executive Yuan" },
  },

  {
    id: "h-228-makeup",
    date: "2026-02-27",
    name: { "zh-TW": "228補假", en: "Day Off (in lieu)" },
    isHoliday: true,
    isMakeup: true,
    description: {
      "zh-TW": "因和平紀念日（2/28）適逢星期六而調整的補假日。",
      en: "A day off in lieu, since Peace Memorial Day (2/28) fell on a Saturday.",
    },
    origin: {
      "zh-TW":
        "1947年2月27日晚間，台北發生查緝私菸衝突，隔日（2月28日）民眾抗議遭到武力鎮壓，事件擴大到全台各地，造成嚴重傷亡，史稱「二二八事件」。1995年，立法院制定《二二八事件處理及補償條例》，將2月28日訂為「和平紀念日」；1997年起成為國定假日，期盼社會共同記取歷史教訓，追求和平與和解。",
      en: "On the evening of February 27, 1947, a cigarette-smuggling enforcement dispute in Taipei escalated into violence. The next day, February 28, protests were met with a military crackdown, and unrest spread across Taiwan with serious loss of life — an event known as the \"228 Incident.\" In 1995 the Legislative Yuan enacted a resolution and compensation act designating February 28 as \"Peace Memorial Day,\" and it became a public holiday in 1997, intended to encourage collective reflection on this history and a shared pursuit of peace and reconciliation.",
    },
    source: {
      "zh-TW": "國史館臺灣文獻館；二二八事件紀念基金會",
      en: "National Museum of Taiwan History Archives; 228 Memorial Foundation",
    },
    isAnchor: true,
    groupLabel: { "zh-TW": "和平紀念日", en: "Peace Memorial Day" },
  },
  {
    id: "h-228",
    date: "2026-02-28",
    name: { "zh-TW": "和平紀念日", en: "Peace Memorial Day" },
    isHoliday: true,
    description: {
      "zh-TW": "紀念1947年228事件的國定假日，提醒社會反思歷史、珍惜民主與人權。",
      en: "A public holiday commemorating the 228 Incident of 1947, encouraging reflection on history, democracy, and human rights.",
    },
    origin: {
      "zh-TW":
        "1947年2月27日晚間，台北發生查緝私菸衝突，隔日（2月28日）民眾抗議遭到武力鎮壓，事件擴大到全台各地，造成嚴重傷亡，史稱「二二八事件」。1995年，立法院制定《二二八事件處理及補償條例》，將2月28日訂為「和平紀念日」；1997年起成為國定假日，期盼社會共同記取歷史教訓，追求和平與和解。",
      en: "On the evening of February 27, 1947, a cigarette-smuggling enforcement dispute in Taipei escalated into violence. The next day, February 28, protests were met with a military crackdown, and unrest spread across Taiwan with serious loss of life — an event known as the \"228 Incident.\" In 1995 the Legislative Yuan enacted a resolution and compensation act designating February 28 as \"Peace Memorial Day,\" and it became a public holiday in 1997, intended to encourage collective reflection on this history and a shared pursuit of peace and reconciliation.",
    },
    source: {
      "zh-TW": "國史館臺灣文獻館；二二八事件紀念基金會",
      en: "National Museum of Taiwan History Archives; 228 Memorial Foundation",
    },
  },

  {
    id: "h-childrens-makeup",
    date: "2026-04-03",
    name: { "zh-TW": "兒童節補假", en: "Day Off (in lieu)" },
    isHoliday: true,
    isMakeup: true,
    description: {
      "zh-TW": "因兒童節（4/4）適逢星期六而調整的補假日。",
      en: "A day off in lieu, since Children's Day (4/4) fell on a Saturday.",
    },
    origin: {
      "zh-TW": "20世紀初，國際上陸續有國家倡議設立兒童節，呼籲社會重視兒童福祉與權益。台灣將兒童節定於4月4日，期望透過這個節日提醒大眾關注兒童的健康成長與應有的照顧。",
      en: "In the early 20th century, a number of countries began establishing a Children's Day to draw attention to children's welfare and rights. Taiwan set its Children's Day on April 4, as a reminder for society to care about children's healthy development and wellbeing.",
    },
    taiwanCustoms: [
      { "zh-TW": "學校與家庭常安排慶祝活動或小禮物", en: "Schools and families often mark the day with small celebrations or gifts" },
      { "zh-TW": "常與清明節相鄰形成連假，許多家庭會安排出遊", en: "Since it usually falls next to Tomb Sweeping Day, many families use the long weekend for a trip" },
    ],
    source: { "zh-TW": "教育部；行政院人事行政總處", en: "Ministry of Education; Directorate-General of Personnel Administration" },
    isAnchor: true,
    groupLabel: { "zh-TW": "兒童節・清明節", en: "Children's Day & Tomb Sweeping Day" },
  },
  {
    id: "h-childrens",
    date: "2026-04-04",
    name: { "zh-TW": "兒童節", en: "Children's Day" },
    isHoliday: true,
    description: {
      "zh-TW": "為守護兒童福祉而設立的國定假日，學校與家庭常會安排相關活動。",
      en: "A public holiday established to promote children's welfare — schools and families often plan activities around it.",
    },
    origin: {
      "zh-TW": "20世紀初，國際上陸續有國家倡議設立兒童節，呼籲社會重視兒童福祉與權益。台灣將兒童節定於4月4日，期望透過這個節日提醒大眾關注兒童的健康成長與應有的照顧。",
      en: "In the early 20th century, a number of countries began establishing a Children's Day to draw attention to children's welfare and rights. Taiwan set its Children's Day on April 4, as a reminder for society to care about children's healthy development and wellbeing.",
    },
    taiwanCustoms: [
      { "zh-TW": "學校與家庭常安排慶祝活動或小禮物", en: "Schools and families often mark the day with small celebrations or gifts" },
      { "zh-TW": "常與清明節相鄰形成連假，許多家庭會安排出遊", en: "Since it usually falls next to Tomb Sweeping Day, many families use the long weekend for a trip" },
    ],
    source: { "zh-TW": "教育部；行政院人事行政總處", en: "Ministry of Education; Directorate-General of Personnel Administration" },
  },
  {
    id: "h-tomb-sweeping",
    date: "2026-04-05",
    name: { "zh-TW": "清明節", en: "Tomb Sweeping Day" },
    isHoliday: true,
    description: {
      "zh-TW": "傳統上家族會前往祖先墳墓掃墓祭拜，表達慎終追遠之意。",
      en: "Families traditionally visit ancestors' graves to clean them and pay respects — a day of remembrance.",
    },
    origin: {
      "zh-TW":
        "清明是「二十四節氣」之一，約落在春分後15天左右，最初是農民依節氣安排農事的日子。後來與古代寒食節、上巳節的掃墓習俗逐漸融合，成為華人社會慎終追遠、祭祖掃墓的重要節日。",
      en: "Qingming is one of the traditional 24 solar terms, falling roughly 15 days after the spring equinox, and originally marked a point in the farming calendar. Over time it absorbed grave-sweeping customs from other ancient spring observances, becoming the key day in Chinese culture for honoring ancestors.",
    },
    taiwanCustoms: [
      { "zh-TW": "掃墓、祭祖", en: "Visiting and cleaning ancestors' graves" },
      { "zh-TW": "部分家庭會「培墓」（整修祖先墳墓）", en: "Some families do 培墓 — tending to and repairing the grave" },
      { "zh-TW": "準備潤餅、草仔粿等應景食物", en: "Preparing seasonal foods like popiah (spring rolls) or caozaiguo rice cakes" },
    ],
    source: { "zh-TW": "教育部臺灣閩南語常用詞辭典；交通部觀光署", en: "Ministry of Education's Taiwanese Hokkien Dictionary; Tourism Administration, MOTC" },
  },
  {
    id: "h-tomb-sweeping-makeup",
    date: "2026-04-06",
    name: { "zh-TW": "清明節補假", en: "Day Off (in lieu)" },
    isHoliday: true,
    isMakeup: true,
    description: {
      "zh-TW": "因清明節（4/5）適逢星期日而調整的補假日。",
      en: "A day off in lieu, since Tomb Sweeping Day (4/5) fell on a Sunday.",
    },
    origin: {
      "zh-TW":
        "清明是「二十四節氣」之一，約落在春分後15天左右，最初是農民依節氣安排農事的日子。後來與古代寒食節、上巳節的掃墓習俗逐漸融合，成為華人社會慎終追遠、祭祖掃墓的重要節日。",
      en: "Qingming is one of the traditional 24 solar terms, falling roughly 15 days after the spring equinox, and originally marked a point in the farming calendar. Over time it absorbed grave-sweeping customs from other ancient spring observances, becoming the key day in Chinese culture for honoring ancestors.",
    },
    taiwanCustoms: [
      { "zh-TW": "掃墓、祭祖", en: "Visiting and cleaning ancestors' graves" },
      { "zh-TW": "部分家庭會「培墓」（整修祖先墳墓）", en: "Some families do 培墓 — tending to and repairing the grave" },
      { "zh-TW": "準備潤餅、草仔粿等應景食物", en: "Preparing seasonal foods like popiah (spring rolls) or caozaiguo rice cakes" },
    ],
    source: { "zh-TW": "教育部臺灣閩南語常用詞辭典；交通部觀光署", en: "Ministry of Education's Taiwanese Hokkien Dictionary; Tourism Administration, MOTC" },
  },

  {
    id: "h-labor",
    date: "2026-05-01",
    name: { "zh-TW": "勞動節", en: "Labor Day" },
    isHoliday: true,
    description: {
      "zh-TW": "向全體勞工致敬的國定假日，自2025年修法後全國統一放假。",
      en: "A public holiday honoring workers — following a 2025 law change, it now applies nationwide, not just to labor-law-covered employees.",
    },
    origin: {
      "zh-TW":
        "5月1日「國際勞動節」源自19世紀末美國工人爭取「八小時工作制」的抗爭行動。台灣自1980年代起將5月1日訂為勞動節，原本僅限適用《勞動基準法》的勞工放假，2025年修法後擴大為全國一致放假，向所有勞工致敬。",
      en: "May 1st, International Labor Day, traces back to 19th-century American labor movements demanding an eight-hour workday. Taiwan designated May 1 as Labor Day starting in the 1980s; originally only workers covered by the Labor Standards Act had the day off, but a 2025 law change extended it to a nationwide holiday honoring all workers.",
    },
    taiwanCustoms: [
      { "zh-TW": "部分縣市有勞工遊行或倡議活動", en: "Some cities see labor rights marches or advocacy events" },
      { "zh-TW": "對多數上班族而言，就是額外的休假日", en: "For most workers, it's simply an extra day off" },
    ],
    source: { "zh-TW": "勞動部；行政院", en: "Ministry of Labor; Executive Yuan" },
    isAnchor: true,
    groupLabel: { "zh-TW": "勞動節", en: "Labor Day" },
  },

  {
    id: "h-dragon-boat",
    date: "2026-06-19",
    name: { "zh-TW": "端午節", en: "Dragon Boat Festival" },
    isHoliday: true,
    description: {
      "zh-TW": "紀念屈原的傳統節日，人們會吃粽子、看划龍舟比賽。",
      en: "A traditional festival commemorating the poet Qu Yuan — people eat zongzi (sticky rice dumplings) and watch dragon boat races.",
    },
    origin: {
      "zh-TW":
        "端午節在農曆五月五日，最初與古代驅邪避疫、順應仲夏氣候變化的習俗有關。民間流傳最廣的說法之一，是為了紀念戰國時代楚國詩人屈原投江自盡，人們划船打撈、投粽子入江以保護他的遺體，逐漸演變成划龍舟、包粽子的習俗——這是廣為流傳的民間傳說，端午節真正的起源學者間仍有不同看法。",
      en: "Dragon Boat Festival falls on the 5th day of the 5th lunar month, originally tied to customs for warding off illness and marking the shift into midsummer. The most widely told folk story links it to the poet Qu Yuan of the ancient state of Chu, who is said to have drowned himself in protest, with people paddling out to search for him and tossing rice dumplings into the river to protect his body — customs said to have evolved into dragon boat racing and eating zongzi. This is a popular folk legend; scholars still debate the festival's actual origins.",
    },
    taiwanCustoms: [
      { "zh-TW": "包粽子、吃粽子", en: "Making and eating zongzi (sticky rice dumplings)" },
      { "zh-TW": "龍舟競賽", en: "Dragon boat races" },
      { "zh-TW": "部分地區有「立蛋」習俗", en: "In some areas, the \"standing an egg on end\" custom" },
    ],
    source: { "zh-TW": "交通部觀光署；教育部", en: "Tourism Administration, MOTC; Ministry of Education" },
    isAnchor: true,
    groupLabel: { "zh-TW": "端午節", en: "Dragon Boat Festival" },
  },

  {
    id: "h-mid-autumn",
    date: "2026-09-25",
    name: { "zh-TW": "中秋節", en: "Mid-Autumn Festival" },
    isHoliday: true,
    description: {
      "zh-TW": "台灣重要的傳統節日之一，家人常會一起賞月、吃月餅、烤肉。",
      en: "One of Taiwan's most important traditional festivals — families often gather to admire the moon, eat mooncakes, and barbecue.",
    },
    origin: {
      "zh-TW":
        "中秋節在農曆八月十五日，這天月亮通常最圓最亮，自古就有賞月的習俗，後來逐漸發展成家人團聚、感謝豐收的節日。「嫦娥奔月」是民間廣為流傳的神話故事之一，用來解釋中秋節與月亮的連結，屬於傳說而非史實。",
      en: "Mid-Autumn Festival falls on the 15th day of the 8th lunar month, when the moon is traditionally at its roundest and brightest — giving rise to ancient moon-viewing customs that grew into a festival for family reunion and giving thanks for the harvest. The story of \"Chang'e flying to the moon\" is a well-known folk myth used to explain the festival's connection to the moon; it's a legend, not historical fact.",
    },
    taiwanCustoms: [
      { "zh-TW": "家人團聚、賞月", en: "Family reunions and moon-viewing" },
      { "zh-TW": "吃月餅、柚子", en: "Eating mooncakes and pomelos" },
      { "zh-TW": "台灣特有的中秋烤肉活動", en: "Outdoor barbecuing — a custom especially popular in Taiwan" },
    ],
    source: { "zh-TW": "交通部觀光署", en: "Tourism Administration, MOTC" },
    isAnchor: true,
    groupLabel: { "zh-TW": "中秋節", en: "Mid-Autumn Festival" },
  },
  {
    id: "h-teachers",
    date: "2026-09-28",
    name: { "zh-TW": "教師節", en: "Teachers' Day" },
    isHoliday: true,
    description: {
      "zh-TW": "紀念孔子誕辰、感謝教師付出的節日，修法後全國放假一天。",
      en: "Commemorating Confucius's birthday and honoring teachers — now a nationwide public holiday following a law change.",
    },
    origin: {
      "zh-TW":
        "台灣的教師節訂在9月28日，源自1930年代教育界人士爭取教師權益的倡議行動。後來政府改以「至聖先師」孔子的誕辰作為教師節，並於1952年考證確定孔子誕辰對應陽曆9月28日，沿用至今，用來表彰教育工作者的貢獻。",
      en: "Taiwan's Teachers' Day falls on September 28. It traces back to a 1930s movement by educators advocating for teachers' rights. The government later tied the holiday to the birthday of Confucius, honored as the \"Foremost Teacher,\" and in 1952 confirmed September 28 as the solar-calendar date used to mark it — the date still used today to honor educators' contributions.",
    },
    taiwanCustoms: [
      { "zh-TW": "各地孔廟舉行祭孔大典", en: "Confucius temples around Taiwan hold formal commemorative ceremonies" },
      { "zh-TW": "學生向老師表達感謝（卡片、獻花等）", en: "Students thank their teachers with cards, flowers, or small gestures" },
      { "zh-TW": "部分縣市頒發優良教師獎", en: "Some cities present awards to outstanding teachers" },
    ],
    source: { "zh-TW": "教育部", en: "Ministry of Education" },
    isAnchor: true,
    groupLabel: { "zh-TW": "教師節", en: "Teachers' Day" },
  },

  {
    id: "h-national-day-makeup",
    date: "2026-10-09",
    name: { "zh-TW": "國慶日補假", en: "Day Off (in lieu)" },
    isHoliday: true,
    isMakeup: true,
    description: {
      "zh-TW": "因國慶日（10/10）適逢星期六而調整的補假日。",
      en: "A day off in lieu, since National Day (10/10) fell on a Saturday.",
    },
    origin: {
      "zh-TW":
        "10月10日紀念1911年的武昌起義，這場起義是推翻清朝、催生中華民國的關鍵事件之一。中華民國政府於隔年（1912年）成立，10月10日因此被訂為國慶日，也就是俗稱的「雙十節」。",
      en: "October 10 commemorates the 1911 Wuchang Uprising, a pivotal event that helped bring down the Qing dynasty and led to the founding of the Republic of China the following year (1912) — which is why October 10 is celebrated as National Day, often called \"Double Ten Day.\"",
    },
    taiwanCustoms: [
      { "zh-TW": "總統府前舉行國慶大會與升旗典禮", en: "A National Day ceremony and flag-raising in front of the Presidential Office" },
      { "zh-TW": "國慶焰火（每年於不同縣市舉辦）", en: "National Day fireworks, hosted in a different city each year" },
    ],
    source: { "zh-TW": "中華民國總統府；內政部", en: "Office of the President, ROC; Ministry of the Interior" },
    isAnchor: true,
    groupLabel: { "zh-TW": "國慶日", en: "National Day" },
  },
  {
    id: "h-national-day",
    date: "2026-10-10",
    name: { "zh-TW": "國慶日", en: "National Day" },
    isHoliday: true,
    description: {
      "zh-TW": "中華民國國慶日，各地會舉辦升旗典禮與慶祝活動。",
      en: "Taiwan's National Day — flag-raising ceremonies and celebrations are held around the country.",
    },
    origin: {
      "zh-TW":
        "10月10日紀念1911年的武昌起義，這場起義是推翻清朝、催生中華民國的關鍵事件之一。中華民國政府於隔年（1912年）成立，10月10日因此被訂為國慶日，也就是俗稱的「雙十節」。",
      en: "October 10 commemorates the 1911 Wuchang Uprising, a pivotal event that helped bring down the Qing dynasty and led to the founding of the Republic of China the following year (1912) — which is why October 10 is celebrated as National Day, often called \"Double Ten Day.\"",
    },
    taiwanCustoms: [
      { "zh-TW": "總統府前舉行國慶大會與升旗典禮", en: "A National Day ceremony and flag-raising in front of the Presidential Office" },
      { "zh-TW": "國慶焰火（每年於不同縣市舉辦）", en: "National Day fireworks, hosted in a different city each year" },
    ],
    source: { "zh-TW": "中華民國總統府；內政部", en: "Office of the President, ROC; Ministry of the Interior" },
  },
  {
    id: "h-retrocession",
    date: "2026-10-25",
    name: { "zh-TW": "台灣光復節", en: "Retrocession Day" },
    isHoliday: true,
    description: {
      "zh-TW": "紀念台灣光復暨金門古寧頭大捷的國定假日。",
      en: "A public holiday commemorating Taiwan's Retrocession and the Battle of Guningtou victory in Kinmen.",
    },
    origin: {
      "zh-TW":
        "1945年10月25日，中華民國政府代表在台北公會堂（今中山堂）接受日本臺灣總督簽署受降文件，象徵二戰結束後台灣結束日本殖民統治；隔年（1946年）政府將這一天訂為「台灣光復節」。2025年，立法院修法將此節日更名為「台灣光復暨金門古寧頭大捷紀念日」，並恢復為國定假日。",
      en: "On October 25, 1945, representatives of the Republic of China government accepted Japan's formal surrender of Taiwan at Taipei Public Hall (today's Zhongshan Hall), marking the end of Japanese colonial rule after World War II. The following year (1946), the government designated this day \"Taiwan Retrocession Day.\" In 2025, the Legislative Yuan renamed it \"Taiwan Retrocession and Guningtou Victory Memorial Day\" and restored it as a public holiday.",
    },
    source: { "zh-TW": "國史館臺灣文獻館", en: "National Museum of Taiwan History Archives" },
    isAnchor: true,
    groupLabel: { "zh-TW": "台灣光復節", en: "Taiwan Retrocession Day" },
  },
  {
    id: "h-retrocession-makeup",
    date: "2026-10-26",
    name: { "zh-TW": "光復節補假", en: "Day Off (in lieu)" },
    isHoliday: true,
    isMakeup: true,
    description: {
      "zh-TW": "因台灣光復節（10/25）適逢星期日而調整的補假日。",
      en: "A day off in lieu, since Retrocession Day (10/25) fell on a Sunday.",
    },
    origin: {
      "zh-TW":
        "1945年10月25日，中華民國政府代表在台北公會堂（今中山堂）接受日本臺灣總督簽署受降文件，象徵二戰結束後台灣結束日本殖民統治；隔年（1946年）政府將這一天訂為「台灣光復節」。2025年，立法院修法將此節日更名為「台灣光復暨金門古寧頭大捷紀念日」，並恢復為國定假日。",
      en: "On October 25, 1945, representatives of the Republic of China government accepted Japan's formal surrender of Taiwan at Taipei Public Hall (today's Zhongshan Hall), marking the end of Japanese colonial rule after World War II. The following year (1946), the government designated this day \"Taiwan Retrocession Day.\" In 2025, the Legislative Yuan renamed it \"Taiwan Retrocession and Guningtou Victory Memorial Day\" and restored it as a public holiday.",
    },
    source: { "zh-TW": "國史館臺灣文獻館", en: "National Museum of Taiwan History Archives" },
  },

  {
    id: "h-constitution",
    date: "2026-12-25",
    name: { "zh-TW": "行憲紀念日", en: "Constitution Day" },
    isHoliday: true,
    description: {
      "zh-TW": "紀念中華民國憲法施行的國定假日，恰與西方聖誕節同一天。",
      en: "A public holiday commemorating the enactment of the ROC Constitution — it coincides with Christmas Day.",
    },
    origin: {
      "zh-TW":
        "1946年12月25日，制憲國民大會三讀通過《中華民國憲法》，並於隔年（1947年）同一天正式施行，這一天因此被訂為「行憲紀念日」。當時的政府刻意選在與西方聖誕節同一天施行憲法，賦予這天「自由、尊嚴」的象徵意義。",
      en: "On December 25, 1946, the Constituent National Assembly passed the Constitution of the Republic of China, which took effect on the same date the following year (1947) — the origin of \"Constitution Day.\" The government of the time deliberately chose to enact the constitution on the same day as Christmas, intending to link the date with themes of freedom and human dignity.",
    },
    source: { "zh-TW": "立法院公報", en: "Legislative Yuan Gazette" },
    isAnchor: true,
    groupLabel: { "zh-TW": "行憲紀念日", en: "Constitution Day" },
  },

  // ── Memorial day (NOT a holiday) ──────────────────────────────────────
  {
    id: "m-921",
    date: "2026-09-21",
    name: { "zh-TW": "921防災日", en: "9/21 Disaster Prevention Day" },
    isHoliday: false,
    description: {
      "zh-TW":
        "紀念1999年921大地震的國家防災日，全台會進行地震避難演練，提醒大眾強化防災意識。這一天並非放假日，機關學校照常運作。",
      en: "National Disaster Prevention Day, commemorating the 1999 Chi-Chi earthquake — nationwide earthquake drills are held to raise disaster awareness. This is NOT a day off; offices and schools operate normally.",
    },
    origin: {
      "zh-TW":
        "1999年9月21日凌晨，台灣中部發生芮氏規模7.3的地震（俗稱「921大地震」或「集集大地震」），造成嚴重傷亡與建築損害，是台灣近代最重大的地震災害之一。政府後續將9月21日訂為「國家防災日」，由內政部消防署主辦全國性地震（及海嘯）避難演練，提醒民眾強化防災意識——但這一天並非放假日。",
      en: "In the early hours of September 21, 1999, a magnitude-7.3 earthquake — known as the Chi-Chi earthquake or the \"921 earthquake\" — struck central Taiwan, causing severe casualties and building damage, one of Taiwan's most significant modern earthquake disasters. The government subsequently designated September 21 as National Disaster Prevention Day, with the National Fire Agency leading nationwide earthquake (and tsunami) evacuation drills to raise public disaster awareness. It is NOT a day off.",
    },
    taiwanCustoms: [
      { "zh-TW": "全台進行地震避難演練", en: "Nationwide earthquake evacuation drills" },
      { "zh-TW": "手機會收到「國家級警報」測試訊息", en: "A test \"National Alert\" message is sent to mobile phones" },
      { "zh-TW": "學校與機關會演練「趴下、掩護、穩住」等避難動作", en: "Schools and offices practice the \"Drop, Cover, Hold On\" response" },
    ],
    source: { "zh-TW": "內政部消防署；中央氣象署", en: "National Fire Agency, Ministry of the Interior; Central Weather Administration" },
    tag: { "zh-TW": "災難紀念日．非放假日", en: "Disaster Memorial · Not a Holiday" },
    isAnchor: true,
    groupLabel: { "zh-TW": "921國家防災日", en: "9/21 Disaster Prevention Day" },
  },
];
