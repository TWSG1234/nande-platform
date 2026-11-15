/**
 * 同義詞／口語概念表。只用來「展開搜尋詞、替相關資料加分」，
 * 不會直接決定答案：展開後的詞仍要在真實資料裡找得到，而且權重低於使用者原本說的詞。
 * 新增內容上架時不需要同步維護這張表。
 */
export interface Concept {
  id: string;
  /** 使用者可能說出的詞 */
  triggers: string[];
  /** 資料裡可能用到的相關詞 */
  expands: string[];
}

export const CONCEPTS: Concept[] = [
  { id: "transport", triggers: ["交通", "搭車", "坐車", "乘車", "搭乘", "坐公車", "公車", "巴士", "客運", "公共運輸", "大眾運輸", "怎麼去", "transport", "transportation", "bus", "get around", "commute", "ride"], expands: ["交通", "公車", "搭乘", "大眾運輸", "客運", "捷運", "火車", "高鐵", "公共自行車", "transportation", "bus"] },
  { id: "train", triggers: ["火車", "台鐵", "鐵路", "train", "railway", "tra"], expands: ["火車", "台鐵", "鐵路", "train", "交通"] },
  { id: "hsr", triggers: ["高鐵", "hsr", "thsr", "high speed"], expands: ["高鐵", "high speed rail", "交通"] },
  { id: "metro", triggers: ["捷運", "mrt", "metro", "subway"], expands: ["捷運", "metro", "mrt", "交通"] },
  { id: "bike", triggers: ["腳踏車", "自行車", "單車", "youbike", "bike", "bicycle"], expands: ["公共自行車", "youbike", "bike", "交通"] },
  { id: "payment-card", triggers: ["悠遊卡", "一卡通", "easycard", "ipass", "票卡", "儲值"], expands: ["載具", "悠遊卡", "一卡通", "交通", "消費"] },
  { id: "food", triggers: ["吃", "食物", "餐", "餐廳", "美食", "小吃", "餓", "宵夜", "早餐", "午餐", "晚餐", "吃飯", "用餐", "飲食", "food", "eat", "eating", "meal", "restaurant", "hungry", "dinner", "lunch", "breakfast"], expands: ["用餐", "餐", "飲食", "合菜", "公筷母匙", "消費", "禮儀", "dining", "food", "eat", "meal"] },
  { id: "dining-manners", triggers: ["筷子", "公筷", "合菜", "餐桌", "禁忌", "chopsticks", "etiquette", "manners", "table manners"], expands: ["用餐禮儀", "公筷母匙", "用餐禁忌", "合菜", "dining etiquette"] },
  { id: "evening", triggers: ["晚上", "夜晚", "夜間", "宵夜", "半夜", "tonight", "evening", "night"], expands: ["晚餐", "夜間", "用餐", "消費", "night", "dining"] },
  { id: "lunch-break", triggers: ["午休", "午睡", "休息", "中午休息", "睡午覺", "nap", "lunch break", "rest time", "midday rest"], expands: ["午休", "午睡", "休息", "midday rest", "nap", "時間"] },
  { id: "time", triggers: ["幾點", "時間", "什麼時候", "幾時", "時刻", "what time", "hours", "schedule"], expands: ["時間", "時刻", "time", "hours"] },
  { id: "flag", triggers: ["升旗", "國旗", "早會", "flag"], expands: ["升旗", "flag raising", "時間"] },
  { id: "money", triggers: ["買東西", "購物", "付錢", "付款", "結帳", "花錢", "發票", "收據", "shopping", "pay", "payment", "receipt", "invoice", "buy"], expands: ["消費", "發票", "載具", "電子發票", "shopping", "invoice", "payments"] },
  { id: "invoice", triggers: ["發票", "對獎", "載具", "條碼", "invoice", "receipt", "carrier", "barcode"], expands: ["發票", "載具", "電子發票", "invoice", "carrier"] },
  { id: "school-office", triggers: ["學校行政", "辦公室", "處室", "註冊", "選課", "成績", "學分", "請假", "學生證", "輔導", "諮商", "心情不好", "office", "register", "registration", "counseling", "leave", "grade"], expands: ["教務處", "學務處", "總務處", "輔導室", "處室", "office"] },
  { id: "cleaning", triggers: ["打掃", "掃地", "值日", "clean", "cleaning", "chores"], expands: ["學生打掃", "student cleaning duty", "打掃"] },
  { id: "uniform", triggers: ["制服", "服裝", "穿什麼", "uniform", "dress code"], expands: ["制服", "school uniforms"] },
  { id: "holiday", triggers: ["放假", "假日", "節日", "過節", "連假", "紀念日", "holiday", "festival", "day off", "celebrate"], expands: ["節日", "放假", "行事曆", "紀念日", "holiday", "festival", "calendar"] },
  { id: "calendar", triggers: ["行事曆", "日期", "哪一天", "calendar", "date"], expands: ["行事曆", "節日", "calendar"] },
  { id: "temple", triggers: ["廟", "拜拜", "宮", "媽祖", "信仰", "祭祀", "temple", "pray", "worship", "religion", "mazu"], expands: ["廟宇", "宮", "信仰", "民間信仰", "temple"] },
  { id: "culture", triggers: ["文化", "習俗", "習慣", "傳統", "禮貌", "culture", "custom", "tradition", "polite"], expands: ["文化", "習俗", "禮儀", "culture", "custom"] },
  { id: "chinese", triggers: ["學中文", "中文", "單字", "詞彙", "拼音", "發音", "怎麼說", "漫畫", "chinese", "vocabulary", "pinyin", "pronounce", "mandarin", "learn chinese", "comic"], expands: ["中文", "單字", "拼音", "漫畫", "關卡", "chinese", "vocabulary"] },
  { id: "greeting", triggers: ["你好", "哈囉", "嗨", "hello", "hi", "hey"], expands: ["你好", "hello"] },
  { id: "phone", triggers: ["手機", "網路", "電話卡", "sim", "wifi", "phone", "data plan"], expands: ["手機", "電話", "網路", "sim", "phone"] },
  { id: "health", triggers: ["生病", "看醫生", "醫院", "診所", "健保", "藥局", "doctor", "hospital", "clinic", "sick", "pharmacy"], expands: ["醫院", "診所", "健保", "doctor", "hospital"] },
  { id: "housing", triggers: ["住宿", "宿舍", "租房", "租屋", "dorm", "housing", "rent", "apartment"], expands: ["住宿", "宿舍", "租屋", "dorm", "housing"] },
];
