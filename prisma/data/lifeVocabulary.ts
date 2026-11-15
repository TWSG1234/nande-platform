/**
 * 中文學習「生活」第 1～8 關：關卡名稱＋單字。
 *
 * 這個檔案裡的 raw 文字就是提供的原始資料（照原樣貼上，格式「中文／拼音：／英文：」），
 * 實際寫進資料庫之前一律經過下面的 cleanText／parseVocabBlock 清理：
 * 去掉前後與多餘空格、全形空白、項目符號、星號、拼音外層括號，並統一「 / 」兩側的空格；
 * 英文內容本身的符號（括號、斜線、問號、%、'）全部保留，英文意思不做任何改寫。
 * 單字順序就是這裡由上到下的順序。
 */
export type LifeVocabWord = { hanzi: string; pinyin: string; english: string };
export type LifeLevelData = { level: number; title: string; raw: string };

export function cleanText(input: string): string {
  return input
    .replace(/[\u00a0\u3000\u200b]/g, " ") // 不換行空白、全形空白、零寬空白 → 一般空白
    .replace(/[*`]/g, "") // markdown 星號、反引號
    .replace(/^[\s•·\-–—]+/, "") // 行首的項目符號
    .replace(/\s*\/\s*/g, " / ") // 「A/B」「A  /B」→「A / B」
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPinyin(input: string): string {
  const t = cleanText(input);
  const wrapped = t.match(/^[(（](.*)[)）]$/);
  return wrapped ? cleanText(wrapped[1]!) : t;
}

/** 解析單一單字區塊：第一行是中文，其後有「拼音：…」「英文：…」。缺任何一項就丟錯，不自行猜測。 */
export function parseVocabBlock(block: string): LifeVocabWord {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const hanzi = cleanText(lines[0] ?? "");
  const pick = (label: string) => {
    const line = lines.find((l) => new RegExp(`^${label}\\s*[:：]`).test(l));
    return line ? line.replace(new RegExp(`^${label}\\s*[:：]`), "") : "";
  };
  const pinyin = cleanPinyin(pick("拼音"));
  const english = cleanText(pick("英文"));
  if (!hanzi || !pinyin || !english) throw new Error(`單字資料不完整：${JSON.stringify(block)}`);
  return { hanzi, pinyin, english };
}

export function parseLevelWords(raw: string): LifeVocabWord[] {
  return raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(parseVocabBlock);
}

export const LIFE_LEVELS: LifeLevelData[] = [
  {
    level: 1,
    title: "第一次見面打招呼：介紹自己",
    raw: `
你好
拼音：nǐ hǎo
英文：Hello

交換生
拼音：jiāo huàn shēng
英文：Exchange student

名字
拼音：míng zi
英文：Name

很高興認識你
拼音：hěn gāo xìng rèn shí nǐ
英文：Nice to meet you

來自
拼音：lái zì
英文：Come from

國家
拼音：guó jiā
英文：Country

年級
拼音：nián jí
英文：Grade / Year in school

同學
拼音：tóng xué
英文：Classmate
`,
  },
  {
    level: 2,
    title: "日常問候：早安、午安、晚安",
    raw: `
早安
拼音：zǎo ān
英文：Good morning

午安
拼音：wǔ ān
英文：Good afternoon

晚安
拼音：wǎn ān
英文：Good night

好久不見
拼音：hǎo jiǔ bù jiàn
英文：Long time no see

最近怎麼樣？
拼音：zuì jìn zěn me yàng?
英文：How have you been lately?

還不錯
拼音：hái bù cuò
英文：Not bad / Quite good

明天見
拼音：míng tiān jiàn
英文：See you tomorrow
`,
  },
  {
    level: 3,
    title: "表達：請、謝謝、對不起、不好意思",
    raw: `
請
拼音：qǐng
英文：Please / To invite

謝謝
拼音：xiè xie
英文：Thank you

不客氣
拼音：bú kè qi
英文：You're welcome

對不起
拼音：duì bù qǐ
英文：I'm sorry (Sincere)

不好意思
拼音：bù hǎo yì si
英文：Excuse me / Sorry (Light)

沒關係
拼音：méi guān xì
英文：It's okay / No problem

麻煩你了
拼音：má fan nǐ le
英文：Sorry to trouble you / Thank you for your help

辛苦了
拼音：xīn kǔ le
英文：Thank you for your hard work / You've worked hard
`,
  },
  {
    level: 4,
    title: "表達情緒",
    raw: `
開心
拼音：kāi xīn
英文：Happy

難過
拼音：nán guò
英文：Sad

生氣
拼音：shēng qì
英文：Angry

累
拼音：lèi
英文：Tired

緊張
拼音：jǐn zhāng
英文：Nervous

興奮
拼音：xīng fèn
英文：Excited

想家
拼音：xiǎng jiā
英文：Homesick

放心
拼音：fàng xīn
英文：Relieved / Reassured
`,
  },
  {
    level: 5,
    title: "超商結帳",
    raw: `
便利商店
拼音：biàn lì shāng diàn
英文：Convenience store

結帳
拼音：jié zhàng
英文：Checkout

微波
拼音：wēi bō
英文：Microwave / Heat up

載具
拼音：zài jù
英文：Mobile barcode for e-invoice

統編
拼音：tǒng biān
英文：Tax ID number

購物袋
拼音：gòu wù dài
英文：Shopping bag

悠遊卡
拼音：yōu yóu kǎ
英文：EasyCard

發票
拼音：fā piào
英文：Receipt / Invoice
`,
  },
  {
    level: 6,
    title: "校園尋求協助與問路",
    raw: `
直走
拼音：zhí zǒu
英文：Go straight

左轉 / 右轉
拼音：zuǒ zhuǎn / yòu zhuǎn
英文：Turn left / Turn right

捷運站
拼音：jié yùn zhàn
英文：MRT Station

公車站
拼音：gōng chē zhàn
英文：Bus stop

轉角
拼音：zhuǎn jiǎo
英文：Corner

對面
拼音：duì miàn
英文：Opposite side

怎麼走
拼音：zěn me zǒu
英文：How to get there?

走路
拼音：zǒu lù
英文：Walk / On foot
`,
  },
  {
    level: 7,
    title: "手搖飲料店點餐",
    raw: `
珍珠奶茶
拼音：zhēn zhū nǎi chá
英文：Bubble milk tea

甜度
拼音：tián dù
英文：Sweetness level

冰塊
拼音：bīng kuài
英文：Ice level

正常甜 / 全糖
拼音：zhèng cháng tián / quán táng
英文：Regular sugar (100%)

少糖
拼音：shǎo táng
英文：Less sugar (70%)

半糖
拼音：bàn táng
英文：Half sugar (50%)

微糖
拼音：wēi táng
英文：Low sugar (30%)

無糖
拼音：wú táng
英文：No sugar (0%)

正常冰
拼音：zhèng cháng bīng
英文：Regular ice / Normal ice

去冰 / 微冰
拼音：qù bīng / wēi bīng
英文：No ice / Low ice

大杯
拼音：dà bēi
英文：Large (L)

中杯
拼音：zhōng bēi
英文：Medium (M)

小杯
拼音：xiǎo bēi
英文：Small (S)
`,
  },
  {
    level: 8,
    title: "台灣傳統與在地節慶",
    raw: `
端午節
拼音：duān wǔ jié
英文：Dragon Boat Festival

粽子
拼音：zòng zi
英文：Zongzi (Sticky rice dumplings)

中秋節
拼音：zhōng qiū jié
英文：Mid-Autumn Festival

月餅
拼音：yuè bǐng
英文：Mooncake

烤肉
拼音：kǎo ròu
英文：Barbecue / BBQ

春節 / 農曆新年
拼音：chūn jié / nóng lì xīn nián
英文：Chinese New Year

紅包
拼音：hóng bāo
英文：Red envelope

跨年
拼音：kuà nián
英文：New Year's Eve celebration

除夕
拼音：chú xī
英文：New Year's Eve (Lunar New Year's Eve)

國慶日
拼音：guó qìng rì
英文：National Day

清明節
拼音：qīng míng jié
英文：Tomb Sweeping Day / Qingming Festival
`,
  },
];

/**
 * 給 prisma/import-life-vocabulary.ts 與 prisma/reset-life-chinese.ts 使用的格式
 * （這兩支既有指令讀的是 LIFE_STAGES：關卡名稱 titleZh＋單字 [中文, 拼音, 英文] 陣列）。
 * 內容完全由上面的 LIFE_LEVELS 經 parseLevelWords 清理後產生，順序就是提供的順序，
 * 所以資料只有一份來源，不會兩邊不一致。
 */
export type LifeStage = { level: number; titleZh: string; words: [string, string, string][] };

export const LIFE_STAGES: LifeStage[] = LIFE_LEVELS.map((l) => ({
  level: l.level,
  titleZh: cleanText(l.title),
  words: parseLevelWords(l.raw).map((w) => [w.hanzi, w.pinyin, w.english] as [string, string, string]),
}));
