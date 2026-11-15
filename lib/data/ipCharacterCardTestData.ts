// IP 角色身分卡的資料——目前只有 1 筆測試資料，之後有正式 IP 角色時，
// 直接在這裡新增物件、或整個換掉這筆測試資料即可，不需要動
// components/IPCharacterCard.tsx 或頁面裡呼叫它的地方。
//
// image（正面「人物」照）、cardImage（背面「卡牌圖」）都留空的時候，
// 卡片會顯示簡單的佔位圖示，之後有正式圖片，把路徑填進對應欄位就會
// 自動換成真的圖片。
export type IpCharacterCardData = {
  id: string;
  name: string;
  position: string; // 定位
  personality: string; // 個性
  quote: string; // 正面下方的「一句話」
  background: string; // 背面「背景」故事
  image?: string; // 正面「人物」照
  cardImage?: string; // 背面「卡牌圖」
};

export const testIpCharacterCard: IpCharacterCardData = {
  id: "IP-001",
  name: "測試角色 Budi 布迪",
  position: "還在設定中（測試資料）",
  personality: "活潑、好奇心旺盛（測試資料）",
  quote: "這裡先放一句角色台詞或標語，之後替換成正式內容。",
  background:
    "這裡先放測試用的角色背景故事，之後會替換成正式內容。這隻角色目前還沒有正式名字與設定，只是用來確認卡片翻轉效果的佔位資料。",
  image: undefined,
  cardImage: undefined,
};
