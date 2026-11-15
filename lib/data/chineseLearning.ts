import { ChineseCategory, ChineseLevel } from "@/lib/types";

export const chineseCategories: ChineseCategory[] = [
  {
    id: "language-adaptation",
    nameZh: "語言適應",
    nameEn: "Language Adaptation",
    description: {
      "zh-TW": "從打招呼到表達情緒，學會日常生活中最基礎的中文溝通句型。",
      en: "From greetings to expressing emotions — build the everyday Chinese phrases you'll use every day.",
    },
    icon: "Languages",
  },
  {
    id: "campus-adaptation",
    nameZh: "校園適應",
    nameEn: "Campus Adaptation",
    description: {
      "zh-TW": "認識教室用品、校園設施與課堂日常，讓你更快融入台灣校園生活。",
      en: "Get familiar with classroom supplies, campus facilities, and everyday school routines in Taiwan.",
    },
    icon: "School",
  },
  {
    id: "social-adaptation",
    nameZh: "人際適應",
    nameEn: "Social Adaptation",
    description: {
      "zh-TW": "學會如何主動與同學互動、尋求協助，建立在台灣的人際連結。",
      en: "Learn how to connect with classmates, ask for help, and build friendships in Taiwan.",
    },
    icon: "Users",
  },
  {
    id: "cultural-exchange",
    nameZh: "文化交流",
    nameEn: "Cultural Exchange",
    description: {
      "zh-TW": "從超商結帳到節慶文化，體驗最道地的台灣日常生活場景。",
      en: "From convenience-store checkout to festival traditions — experience authentic everyday life in Taiwan.",
    },
    icon: "Sparkles",
  },
];

export const chineseLevels: ChineseLevel[] = [
  // ───────────────────────── 語言適應 Language Adaptation ─────────────────────────
  {
    id: "language-adaptation-1",
    categoryId: "language-adaptation",
    level: 1,
    title: { "zh-TW": "第一次見面打招呼：介紹自己", en: "First Meeting: Introducing Yourself" },
    drink: { liquid: "empty" },
    vocabulary: [
      { chinese: "你好", pinyin: "nǐ hǎo", english: "Hello" },
      { chinese: "交換生", pinyin: "jiāo huàn shēng", english: "Exchange student" },
      { chinese: "名字", pinyin: "míng zi", english: "Name" },
      { chinese: "很高興認識你", pinyin: "hěn gāo xìng rèn shí nǐ", english: "Nice to meet you" },
      { chinese: "來自", pinyin: "lái zì", english: "Come from" },
      { chinese: "國家", pinyin: "guó jiā", english: "Country" },
      { chinese: "年級", pinyin: "nián jí", english: "Grade / Year in school" },
      { chinese: "同學", pinyin: "tóng xué", english: "Classmate" },
    ],
    sentences: [
      { speaker: "A", chinese: "你好！很高興認識你，我叫小明。你叫什麼名字？", pinyin: "Nǐ hǎo! Hěn gāoxìng rènshi nǐ, wǒ jiào Xiǎomíng. Nǐ jiào shénme míngzi?", english: "Hello! Nice to meet you, I'm Xiaoming. What's your name?" },
      { speaker: "B", chinese: "你好！我叫 Alex，我是剛來的交換生。", pinyin: "Nǐ hǎo! Wǒ jiào Alex, wǒ shì gāng lái de jiāohuànshēng.", english: "Hi! I'm Alex, I'm a new exchange student." },
      { speaker: "A", chinese: "你是從哪一個國家來的？", pinyin: "Nǐ shì cóng nǎ yí ge guójiā lái de?", english: "Which country are you from?" },
      { speaker: "B", chinese: "我來自美國。我今年讀高二，請多指教！", pinyin: "Wǒ láizì Měiguó. Wǒ jīnnián dú gāo èr, qǐng duō zhǐjiào!", english: "I'm from the United States. I'm a junior in high school this year — look forward to getting to know you!" },
    ],
  },
  {
    id: "language-adaptation-2",
    categoryId: "language-adaptation",
    level: 2,
    title: { "zh-TW": "日常問候：早安、午安、晚安", en: "Daily Greetings: Morning, Afternoon, and Night" },
    drink: { liquid: "milk" },
    vocabulary: [
      { chinese: "早安", pinyin: "zǎo ān", english: "Good morning" },
      { chinese: "早", pinyin: "zǎo", english: "Morning! (Casual)" },
      { chinese: "午安", pinyin: "wǔ ān", english: "Good afternoon" },
      { chinese: "晚安", pinyin: "wǎn ān", english: "Good night" },
      { chinese: "最近怎麼樣？", pinyin: "zuì jìn zěn me yàng?", english: "How have you been lately?" },
      { chinese: "還不錯", pinyin: "hái bù cuò", english: "Not bad / Quite good" },
      { chinese: "辛苦了", pinyin: "xīn kǔ le", english: "Thanks for your hard work / Good job" },
      { chinese: "明天見", pinyin: "míng tiān jiàn", english: "See you tomorrow" },
    ],
    sentences: [
      { speaker: "A", chinese: "早安！你今天看起來很有精神喔！", pinyin: "Zǎoān! Nǐ jīntiān kànqǐlái hěn yǒu jīngshén ō!", english: "Good morning! You look really energetic today!" },
      { speaker: "B", chinese: "早！因為我昨天很早就睡了。最近怎麼樣？", pinyin: "Zǎo! Yīnwèi wǒ zuótiān hěn zǎo jiù shuì le. Zuìjìn zěnmeyàng?", english: "Morning! I went to bed early yesterday. How have you been lately?" },
      { speaker: "A", chinese: "還不錯啊！放學後要回家了嗎？", pinyin: "Hái búcuò a! Fàngxué hòu yào huí jiā le ma?", english: "Pretty good! Are you heading home after school?" },
      { speaker: "B", chinese: "對啊，今天有點累。那我先走了，明天見！", pinyin: "Duì a, jīntiān yǒudiǎn lèi. Nà wǒ xiān zǒu le, míngtiān jiàn!", english: "Yeah, I'm a bit tired today. I'll head off then — see you tomorrow!" },
      { speaker: "A", chinese: "好，晚安！辛苦了！", pinyin: "Hǎo, wǎn'ān! Xīnkǔ le!", english: "Okay, good night! Great work today!" },
    ],
  },
  {
    id: "language-adaptation-3",
    categoryId: "language-adaptation",
    level: 3,
    title: { "zh-TW": "表達：請、謝謝、對不起、不好意思", en: "Everyday Manners: Please, Thank You, and Sorry" },
    drink: { liquid: "tea" },
    vocabulary: [
      { chinese: "請", pinyin: "qǐng", english: "Please / To invite" },
      { chinese: "謝謝", pinyin: "xiè xie", english: "Thank you" },
      { chinese: "不客氣", pinyin: "bú kè qi", english: "You're welcome" },
      { chinese: "對不起", pinyin: "duì bù qǐ", english: "I'm sorry (Sincere)" },
      { chinese: "不好意思", pinyin: "bù hǎo yì si", english: "Excuse me / Sorry (Light)" },
      { chinese: "沒關係", pinyin: "méi guān xi", english: "It's okay / No problem" },
      { chinese: "麻煩你了", pinyin: "má fan nǐ le", english: "Sorry to trouble you / Thank you for your help" },
    ],
    sentences: [
      { speaker: "A", chinese: "不好意思，請告訴我廁所在哪裡？", pinyin: "Bù hǎoyìsi, qǐng gàosù wǒ cèsuǒ zài nǎlǐ?", english: "Excuse me, could you tell me where the restroom is?" },
      { speaker: "B", chinese: "在前面右轉就到了喔！", pinyin: "Zài qiánmiàn yòu zhuǎn jiù dào le ō!", english: "Turn right up ahead and you'll find it!" },
      { speaker: "A", chinese: "好的，非常謝謝你！", pinyin: "Hǎo de, fēicháng xièxie nǐ!", english: "Okay, thank you so much!" },
      { speaker: "B", chinese: "不客氣！", pinyin: "Bú kèqi!", english: "You're welcome!" },
      { speaker: "A", chinese: "（不小心撞到人）對不起！你還好嗎？", pinyin: "(Bù xiǎoxīn zhuàng dào rén) Duìbùqǐ! Nǐ hái hǎo ma?", english: "(Accidentally bumps into someone) I'm so sorry! Are you okay?" },
      { speaker: "B", chinese: "沒關係，我沒事！", pinyin: "Méiguānxi, wǒ méishì!", english: "It's okay, I'm fine!" },
    ],
  },
  {
    id: "language-adaptation-4",
    categoryId: "language-adaptation",
    level: 4,
    title: { "zh-TW": "表達情緒", en: "Expressing Emotions" },
    drink: { liquid: "bubbleTea" },
    vocabulary: [
      { chinese: "開心", pinyin: "kāi xīn", english: "Happy" },
      { chinese: "難過", pinyin: "nán guò", english: "Sad" },
      { chinese: "生氣", pinyin: "shēng qì", english: "Angry" },
      { chinese: "累", pinyin: "lèi", english: "Tired" },
      { chinese: "緊張", pinyin: "jǐn zhāng", english: "Nervous" },
      { chinese: "興奮", pinyin: "xīng fèn", english: "Excited" },
      { chinese: "想家", pinyin: "xiǎng jiā", english: "Homesick" },
      { chinese: "放心", pinyin: "fàng xīn", english: "Relieved / Reassured" },
    ],
    sentences: [
      { speaker: "A", chinese: "你看起來有點緊張，怎麼了？", pinyin: "Nǐ kànqǐlái yǒudiǎn jǐnzhāng, zěnme le?", english: "You look a little nervous, what's wrong?" },
      { speaker: "B", chinese: "我等一下要在全班面前做報告，好緊張喔！", pinyin: "Wǒ děng yíxià yào zài quán bān miànqián zuò bàogào, hǎo jǐnzhāng ō!", english: "I have to give a presentation in front of the whole class in a bit — I'm so nervous!" },
      { speaker: "A", chinese: "別擔心，你準備得很棒，放心吧！", pinyin: "Bié dānxīn, nǐ zhǔnbèi de hěn bàng, fàngxīn ba!", english: "Don't worry, you've prepared really well — relax!" },
      { speaker: "B", chinese: "謝謝你！其實我今天也有點想家，但跟你聊天後開心多了！", pinyin: "Xièxie nǐ! Qíshí wǒ jīntiān yě yǒudiǎn xiǎngjiā, dàn gēn nǐ liáotiān hòu kāixīn duō le!", english: "Thank you! Actually I've been feeling a bit homesick today too, but chatting with you has made me much happier!" },
    ],
  },

  // ───────────────────────── 校園適應 Campus Adaptation ─────────────────────────
  {
    id: "campus-adaptation-1",
    categoryId: "campus-adaptation",
    level: 1,
    title: { "zh-TW": "課堂用品與借用", en: "Classroom Supplies & Borrowing Items" },
    drink: { liquid: "bubbleTea", ice: true },
    vocabulary: [
      { chinese: "課本", pinyin: "kè běn", english: "Textbook" },
      { chinese: "鉛筆", pinyin: "qiān bǐ", english: "Pencil" },
      { chinese: "原子筆", pinyin: "yuán zǐ bǐ", english: "Ballpoint pen" },
      { chinese: "修正帶", pinyin: "xiū zhèng dài", english: "Correction tape" },
      { chinese: "筆記本", pinyin: "bǐ jì běn", english: "Notebook" },
      { chinese: "借", pinyin: "jiè", english: "Borrow / Lend" },
      { chinese: "螢光筆", pinyin: "yíng guāng bǐ", english: "Highlighter" },
      { chinese: "橡皮擦", pinyin: "xiàng pí cā", english: "Eraser" },
    ],
    sentences: [
      { speaker: "交換生", chinese: "糟糕，我今天忘記帶筆袋了。", pinyin: "Zāogāo, wǒ jīntiān wàngjì dài bǐdài le.", english: "Oh no, I forgot to bring my pencil case today." },
      { speaker: "同學", chinese: "沒關係，你需要什麼？我可以借你。", pinyin: "Méiguānxi, nǐ xūyào shénme? Wǒ kěyǐ jiè nǐ.", english: "No worries, what do you need? I can lend it to you." },
      { speaker: "交換生", chinese: "請問你有多的原子筆和修正帶可以借我嗎？", pinyin: "Qǐngwèn nǐ yǒu duō de yuánzǐbǐ hàn xiūzhèngdài kěyǐ jiè wǒ ma?", english: "Do you happen to have a spare pen and correction tape I could borrow?" },
      { speaker: "同學", chinese: "給你！這支黑色的筆和修正帶給你用。", pinyin: "Gěi nǐ! Zhè zhī hēisè de bǐ hàn xiūzhèngdài gěi nǐ yòng.", english: "Here you go! Use this black pen and the correction tape." },
      { speaker: "交換生", chinese: "太感謝你了！放學前我再還你。", pinyin: "Tài gǎnxiè nǐ le! Fàngxué qián wǒ zài huán nǐ.", english: "Thank you so much! I'll give them back before school ends." },
    ],
  },
  {
    id: "campus-adaptation-2",
    categoryId: "campus-adaptation",
    level: 2,
    title: { "zh-TW": "校園設施與環境", en: "Campus Facilities & Surroundings" },
    drink: { liquid: "bubbleTea", ice: true },
    vocabulary: [
      { chinese: "教室", pinyin: "jiào shì", english: "Classroom" },
      { chinese: "保健室", pinyin: "bǎo jiàn shì", english: "Health center / Nurse's office" },
      { chinese: "合作社 / 福利社", pinyin: "hé zuò shè / fú lì shè", english: "School tuck shop / Coop store" },
      { chinese: "圖書館", pinyin: "tú shū guǎn", english: "Library" },
      { chinese: "操場", pinyin: "cāo chǎng", english: "Sports field / Track" },
      { chinese: "飲水機", pinyin: "yǐn shuǐ jī", english: "Water dispenser" },
      { chinese: "男廁 / 女廁", pinyin: "nán cè / nǚ cè", english: "Men's room / Women's restroom" },
      { chinese: "教官室", pinyin: "jiào guān shì", english: "Military instructors' office" },
    ],
    sentences: [
      { speaker: "交換生", chinese: "不好意思，請問飲水機在哪裡？我想裝水。", pinyin: "Bù hǎoyìsi, qǐngwèn yǐnshuǐjī zài nǎlǐ? Wǒ xiǎng zhuāng shuǐ.", english: "Excuse me, where's the water dispenser? I'd like to fill my bottle." },
      { speaker: "同學", chinese: "飲水機在樓梯旁邊，走過去就看到了。", pinyin: "Yǐnshuǐjī zài lóutī pángbiān, zǒu guòqù jiù kàndào le.", english: "The water dispenser is next to the stairs — you'll see it once you walk over." },
      { speaker: "交換生", chinese: "那你知道合作社在哪裡嗎？我想去買午餐。", pinyin: "Nà nǐ zhīdào hézuòshè zài nǎlǐ ma? Wǒ xiǎng qù mǎi wǔcān.", english: "Do you know where the school store is? I want to grab lunch." },
      { speaker: "同學", chinese: "合作社在地下室一樓，我剛好要去，我們一起走吧！", pinyin: "Hézuòshè zài dìxiàshì yī lóu, wǒ gānghǎo yào qù, wǒmen yìqǐ zǒu ba!", english: "The school store is on basement level 1 — I'm actually heading there too, let's go together!" },
    ],
  },
  {
    id: "campus-adaptation-3",
    categoryId: "campus-adaptation",
    level: 3,
    title: { "zh-TW": "校門口早餐店點餐", en: "Ordering at the Breakfast Shop by the School Gate" },
    drink: { liquid: "bubbleTea", ice: true },
    vocabulary: [
      { chinese: "蛋餅", pinyin: "dàn bǐng", english: "Taiwanese egg crepe / Danbing" },
      { chinese: "蘿蔔糕", pinyin: "luó bo gāo", english: "Radish cake" },
      { chinese: "吐司", pinyin: "tǔ sī", english: "Toast" },
      { chinese: "豆漿", pinyin: "dòu jiāng", english: "Soy milk" },
      { chinese: "大冰奶", pinyin: "dà bīng nǎi", english: "Large iced milk tea" },
      { chinese: "切", pinyin: "qiē", english: "To cut" },
      { chinese: "加辣", pinyin: "jiā là", english: "Add chili / Spicy" },
      { chinese: "內用 / 外帶", pinyin: "nèi yòng / wài dài", english: "Dine-in / Takeaway" },
    ],
    sentences: [
      { speaker: "老闆", chinese: "帥哥/美女，今天想吃什麼？內用還是外帶？", pinyin: "Shuàigē/měinǚ, jīntiān xiǎng chī shénme? Nèiyòng háishì wàidài?", english: "Hey there! What would you like today? Dine-in or takeaway?" },
      { speaker: "交換生", chinese: "我要外帶。一份培根蛋餅和一杯大冰奶。", pinyin: "Wǒ yào wàidài. Yí fèn péigēn dànbǐng hàn yì bēi dà bīngnǎi.", english: "Takeaway, please. One bacon egg crepe and a large iced milk tea." },
      { speaker: "老闆", chinese: "蛋餅要不要加辣？要切嗎？", pinyin: "Dànbǐng yào bú yào jiā là? Yào qiē ma?", english: "Want chili in the egg crepe? Should I cut it up for you?" },
      { speaker: "交換生", chinese: "要切，加一點點辣就好了。", pinyin: "Yào qiē, jiā yìdiǎndiǎn là jiù hǎo le.", english: "Yes please, and just a little bit of chili is fine." },
      { speaker: "老闆", chinese: "好的，這樣總共 65 元，旁邊稍等一下喔！", pinyin: "Hǎo de, zhèyàng zǒnggòng liùshíwǔ yuán, pángbiān shāo děng yíxià ō!", english: "Got it, that'll be 65 NT dollars total — just wait to the side for a moment!" },
    ],
  },
  {
    id: "campus-adaptation-4",
    categoryId: "campus-adaptation",
    level: 4,
    title: { "zh-TW": "校園請假與請教老師", en: "Asking for Leave & Talking to Teachers" },
    drink: { liquid: "bubbleTea", ice: true },
    vocabulary: [
      { chinese: "請假", pinyin: "qǐng jià", english: "Ask for leave" },
      { chinese: "病假", pinyin: "bìng jià", english: "Sick leave" },
      { chinese: "事假", pinyin: "shì jià", english: "Personal leave" },
      { chinese: "證明", pinyin: "zhèng míng", english: "Certificate / Proof" },
      { chinese: "班導師", pinyin: "bān dǎo shī", english: "Homeroom teacher" },
      { chinese: "作業", pinyin: "zuò yè", english: "Homework" },
      { chinese: "補交", pinyin: "bǔ jiāo", english: "Make up / Hand in late" },
      { chinese: "聽不懂", pinyin: "tīng bù dǒng", english: "Do not understand" },
    ],
    sentences: [
      { speaker: "交換生", chinese: "老師好，我昨天身體不舒服去看了醫生，這是我的診斷證明。", pinyin: "Lǎoshī hǎo, wǒ zuótiān shēntǐ bù shūfú qù kàn le yīshēng, zhè shì wǒ de zhěnduàn zhèngmíng.", english: "Hello Teacher, I wasn't feeling well yesterday so I saw a doctor — here's my medical certificate." },
      { speaker: "老師", chinese: "好的，我幫你登記病假。今天身體有好一點嗎？", pinyin: "Hǎo de, wǒ bāng nǐ dēngjì bìngjià. Jīntiān shēntǐ yǒu hǎo yìdiǎn ma?", english: "Okay, I'll mark it as sick leave for you. Are you feeling any better today?" },
      { speaker: "交換生", chinese: "有好多了，謝謝老師。請問昨天的數學作業我可以明天補交嗎？", pinyin: "Yǒu hǎo duō le, xièxie lǎoshī. Qǐngwèn zuótiān de shùxué zuòyè wǒ kěyǐ míngtiān bǔjiāo ma?", english: "Much better, thank you. Could I hand in yesterday's math homework tomorrow instead?" },
      { speaker: "老師", chinese: "可以，如果上課有聽不懂的地方，隨時來教員室找我喔！", pinyin: "Kěyǐ, rúguǒ shàngkè yǒu tīng bù dǒng de dìfāng, suíshí lái jiàoyuánshì zhǎo wǒ ō!", english: "Sure. And if there's anything in class you don't understand, feel free to come find me in the staff room anytime!" },
    ],
  },

  // ───────────────────────── 人際適應 Social Adaptation ─────────────────────────
  {
    id: "social-adaptation-1",
    categoryId: "social-adaptation",
    level: 1,
    title: { "zh-TW": "與同學課後互動", en: "Hanging Out with Classmates After School" },
    drink: { liquid: "bubbleTea", ice: true, foam: true },
    vocabulary: [
      { chinese: "放學", pinyin: "fàng xué", english: "School dismisses / After school" },
      { chinese: "一起", pinyin: "yì qǐ", english: "Together" },
      { chinese: "社團", pinyin: "shè tuán", english: "School club" },
      { chinese: "玩", pinyin: "wán", english: "Hang out / Play" },
      { chinese: "打籃球", pinyin: "dǎ lán qiú", english: "Play basketball" },
      { chinese: "聊聊天", pinyin: "liáo liáo tiān", english: "Chat" },
      { chinese: "聯絡方式", pinyin: "lián luò fāng shì", english: "Contact information" },
      { chinese: "加 LINE / IG", pinyin: "jiā LINE / IG", english: "Add on LINE / Instagram" },
    ],
    sentences: [
      { speaker: "同學", chinese: "放學後要不要一起去打籃球？", pinyin: "Fàngxué hòu yào bú yào yìqǐ qù dǎ lánqiú?", english: "Want to play basketball together after school?" },
      { speaker: "交換生", chinese: "好啊！我很喜歡打籃球。幾點在哪裡集合？", pinyin: "Hǎo a! Wǒ hěn xǐhuān dǎ lánqiú. Jǐ diǎn zài nǎlǐ jíhé?", english: "Sure! I love playing basketball. What time and where should we meet?" },
      { speaker: "同學", chinese: "我們五點在體育館見。我可以加你的 IG 嗎？方便聯絡。", pinyin: "Wǒmen wǔ diǎn zài tǐyùguǎn jiàn. Wǒ kěyǐ jiā nǐ de IG ma? Fāngbiàn liánluò.", english: "Let's meet at the gym at 5. Can I add you on Instagram? It'll make it easier to stay in touch." },
      { speaker: "交換生", chinese: "當然可以！我的帳號是這個，我加你了！", pinyin: "Dāngrán kěyǐ! Wǒ de zhànghào shì zhège, wǒ jiā nǐ le!", english: "Of course! Here's my username — I've added you!" },
    ],
  },
  {
    id: "social-adaptation-2",
    categoryId: "social-adaptation",
    level: 2,
    title: { "zh-TW": "校園尋求協助與問路", en: "Asking for Help & Directions" },
    drink: { liquid: "bubbleTea", ice: true, foam: true },
    vocabulary: [
      { chinese: "直走", pinyin: "zhí zǒu", english: "Go straight" },
      { chinese: "左轉 / 右轉", pinyin: "zuǒ zhuǎn / yòu zhuǎn", english: "Turn left / Turn right" },
      { chinese: "捷運站", pinyin: "jié yùn zhàn", english: "MRT Station" },
      { chinese: "公車站", pinyin: "gōng chē zhàn", english: "Bus stop" },
      { chinese: "轉角", pinyin: "zhuǎn jiǎo", english: "Corner" },
      { chinese: "對面", pinyin: "duì miàn", english: "Opposite side" },
      { chinese: "怎麼走", pinyin: "zěn me zǒu", english: "How to get there?" },
      { chinese: "走路", pinyin: "zǒu lù", english: "Walk / On foot" },
    ],
    sentences: [
      { speaker: "交換生", chinese: "不好意思，請問台北車站要怎麼走？", pinyin: "Bù hǎoyìsi, qǐngwèn Táiběi Chēzhàn yào zěnme zǒu?", english: "Excuse me, how do I get to Taipei Main Station?" },
      { speaker: "路人", chinese: "你從這裡一直走，看到便利商店後右轉。", pinyin: "Nǐ cóng zhèlǐ yìzhí zǒu, kàndào biànlì shāngdiàn hòu yòu zhuǎn.", english: "Just walk straight from here, and turn right when you see the convenience store." },
      { speaker: "交換生", chinese: "右轉之後呢？要走很久嗎？", pinyin: "Yòu zhuǎn zhīhòu ne? Yào zǒu hěn jiǔ ma?", english: "And after turning right? Is it a long walk?" },
      { speaker: "路人", chinese: "右轉再走三分鐘，捷運站入口就在你的對面了。", pinyin: "Yòu zhuǎn zài zǒu sān fēnzhōng, jiéyùnzhàn rùkǒu jiù zài nǐ de duìmiàn le.", english: "Walk three more minutes after the turn, and the MRT station entrance will be right across from you." },
      { speaker: "交換生", chinese: "明白了，謝謝你的幫忙！", pinyin: "Míngbái le, xièxie nǐ de bāngmáng!", english: "Got it, thanks so much for your help!" },
    ],
  },
  {
    id: "social-adaptation-3",
    categoryId: "social-adaptation",
    level: 3,
    title: { "zh-TW": "身體不適與求助", en: "Feeling Unwell & Seeking Help" },
    drink: { liquid: "bubbleTea", ice: true, foam: true },
    vocabulary: [
      { chinese: "看醫生", pinyin: "kàn yī shēng", english: "See a doctor" },
      { chinese: "診所", pinyin: "zhěn suǒ", english: "Clinic" },
      { chinese: "感冒", pinyin: "gǎn mào", english: "Catch a cold" },
      { chinese: "發燒", pinyin: "fā shāo", english: "Have a fever" },
      { chinese: "頭痛", pinyin: "tóu tòng", english: "Headache" },
      { chinese: "拉肚子", pinyin: "lā dù zi", english: "Diarrhea" },
      { chinese: "咳嗽", pinyin: "ké sou", english: "Cough" },
      { chinese: "吃藥", pinyin: "chī yào", english: "Take medicine" },
    ],
    sentences: [
      { speaker: "同學", chinese: "你看起來臉色不太好，怎麼了？", pinyin: "Nǐ kànqǐlái liǎnsè bú tài hǎo, zěnme le?", english: "You don't look so well — what's wrong?" },
      { speaker: "交換生", chinese: "我覺得身體很不舒服，好像感冒了。", pinyin: "Wǒ juéde shēntǐ hěn bù shūfú, hǎoxiàng gǎnmào le.", english: "I'm feeling really unwell, I think I've caught a cold." },
      { speaker: "同學", chinese: "有什麼症狀嗎？發燒了嗎？", pinyin: "Yǒu shénme zhèngzhuàng ma? Fāshāo le ma?", english: "Any symptoms? Do you have a fever?" },
      { speaker: "交換生", chinese: "我頭痛而且一直咳嗽，好像有點發燒。", pinyin: "Wǒ tóutòng érqiě yìzhí késòu, hǎoxiàng yǒudiǎn fāshāo.", english: "I have a headache and I keep coughing — I think I might have a slight fever too." },
      { speaker: "同學", chinese: "我現在陪你去保健室量體溫，放學再帶你去診所看醫生吧！", pinyin: "Wǒ xiànzài péi nǐ qù bǎojiànshì liáng tǐwēn, fàngxué zài dài nǐ qù zhěnsuǒ kàn yīshēng ba!", english: "I'll go with you to the health center now to check your temperature, and take you to the clinic after school!" },
    ],
  },

  // ───────────────────────── 文化交流 Cultural Exchange ─────────────────────────
  {
    id: "cultural-exchange-1",
    categoryId: "cultural-exchange",
    level: 1,
    title: { "zh-TW": "超商結帳", en: "Checking Out at a Convenience Store" },
    drink: { liquid: "bubbleTea", ice: true, foam: true, straw: true },
    vocabulary: [
      { chinese: "便利商店", pinyin: "biàn lì shāng diàn", english: "Convenience store" },
      { chinese: "結帳", pinyin: "jié zhàng", english: "Checkout" },
      { chinese: "微波", pinyin: "wēi bō", english: "Microwave / Heat up" },
      { chinese: "載具", pinyin: "zài jù", english: "Mobile barcode for e-invoice" },
      { chinese: "統編", pinyin: "tǒng biān", english: "Tax ID number" },
      { chinese: "購物袋", pinyin: "gòu wù dài", english: "Shopping bag" },
      { chinese: "悠遊卡", pinyin: "yōu yóu kǎ", english: "EasyCard" },
      { chinese: "發票", pinyin: "fā piào", english: "Receipt / Invoice" },
    ],
    sentences: [
      { speaker: "店員", chinese: "你好，便當需要加熱微波嗎？", pinyin: "Nǐ hǎo, biàndāng xūyào jiārè wēibō ma?", english: "Hi there, would you like your lunch box heated up?" },
      { speaker: "交換生", chinese: "需要，麻煩幫我微波，謝謝。", pinyin: "Xūyào, máfan bāng wǒ wēibō, xièxie.", english: "Yes please, could you heat it up for me? Thanks." },
      { speaker: "店員", chinese: "發票有需要載具或統編嗎？", pinyin: "Fāpiào yǒu xūyào zàijù huò tǒngbiān ma?", english: "Do you need the receipt linked to a mobile barcode or tax ID?" },
      { speaker: "交換生", chinese: "沒有，印出來給我就好。請問需要加購購物袋嗎？", pinyin: "Méiyǒu, yìn chūlái gěi wǒ jiù hǎo. Qǐngwèn xūyào jiā gòu gòuwùdài ma?", english: "No, just print it out for me. Also, do I need to buy a shopping bag?" },
      { speaker: "店員", chinese: "袋子一個兩元，總共 102 元。", pinyin: "Dàizi yí ge liǎng yuán, zǒnggòng yìbǎi líng èr yuán.", english: "A bag is 2 NT dollars each — that's 102 NT dollars total." },
      { speaker: "交換生", chinese: "好，那我用悠遊卡刷，謝謝！", pinyin: "Hǎo, nà wǒ yòng yōuyóukǎ shuā, xièxie!", english: "Okay, I'll pay with my EasyCard then, thanks!" },
    ],
  },
  {
    id: "cultural-exchange-2",
    categoryId: "cultural-exchange",
    level: 2,
    title: { "zh-TW": "手搖飲料店點餐", en: "Ordering at a Bubble Tea Shop" },
    drink: { liquid: "bubbleTea", ice: true, foam: true, straw: true },
    vocabulary: [
      { chinese: "珍珠奶茶", pinyin: "zhēn zhū nǎi chá", english: "Bubble milk tea" },
      { chinese: "甜度", pinyin: "tián dù", english: "Sweetness level" },
      { chinese: "冰塊", pinyin: "bīng kuài", english: "Ice level" },
      { chinese: "正常甜 / 全糖", pinyin: "zhèng cháng tián / quán táng", english: "Regular sugar (100%)" },
      { chinese: "少糖", pinyin: "shǎo táng", english: "Less sugar (70%)" },
      { chinese: "半糖", pinyin: "bàn táng", english: "Half sugar (50%)" },
      { chinese: "微糖", pinyin: "wēi táng", english: "Low sugar (30%)" },
      { chinese: "無糖", pinyin: "wú táng", english: "No sugar (0%)" },
      { chinese: "去冰 / 微冰", pinyin: "qù bīng / wēi bīng", english: "No ice / Low ice" },
    ],
    sentences: [
      { speaker: "店員", chinese: "您好，今天想喝什麼？", pinyin: "Nín hǎo, jīntiān xiǎng hē shénme?", english: "Hello! What would you like to drink today?" },
      { speaker: "交換生", chinese: "我要一杯大杯珍珠奶茶。", pinyin: "Wǒ yào yì bēi dà bēi zhēnzhū nǎichá.", english: "I'll have a large bubble milk tea." },
      { speaker: "店員", chinese: "好的，甜度冰塊怎麼調整呢？", pinyin: "Hǎo de, tiándù bīngkuài zěnme tiáozhěng ne?", english: "Got it — how would you like the sweetness and ice level?" },
      { speaker: "交換生", chinese: "我要微糖、微冰。", pinyin: "Wǒ yào wēitáng, wēibīng.", english: "Low sugar and light ice, please." },
      { speaker: "店員", chinese: "好，大杯珍奶微糖微冰，一共 60 元。", pinyin: "Hǎo, dà bēi zhēnnǎi wēitáng wēibīng, yígòng liùshí yuán.", english: "Sure, one large bubble milk tea with low sugar and light ice — that's 60 NT dollars total." },
    ],
  },
  {
    id: "cultural-exchange-3",
    categoryId: "cultural-exchange",
    level: 3,
    title: { "zh-TW": "餐廳與夜市點餐", en: "Ordering at a Restaurant or Night Market" },
    drink: { liquid: "bubbleTea", ice: true, foam: true, straw: true },
    vocabulary: [
      { chinese: "菜單", pinyin: "cài dān", english: "Menu" },
      { chinese: "推薦", pinyin: "tuī jiàn", english: "Recommendation" },
      { chinese: "招牌", pinyin: "zhāo pái", english: "House specialty / Signature dish" },
      { chinese: "臭豆腐", pinyin: "chòu dòu fǔ", english: "Stinky tofu" },
      { chinese: "地瓜球", pinyin: "dì guā qiú", english: "Sweet potato balls" },
      { chinese: "雞排", pinyin: "jī pái", english: "Fried chicken cutlet" },
      { chinese: "一份 / 一串", pinyin: "yí fèn / yí chuàn", english: "One portion / One skewer" },
      { chinese: "買單 / 結帳", pinyin: "mǎi dān / jié zhàng", english: "Pay the bill" },
    ],
    sentences: [
      { speaker: "交換生", chinese: "不好意思，請問你們這裡最有名的招牌菜是什麼？", pinyin: "Bù hǎoyìsi, qǐngwèn nǐmen zhèlǐ zuì yǒumíng de zhāopáicài shì shénme?", english: "Excuse me, what's your most famous specialty dish here?" },
      { speaker: "老闆", chinese: "我們地瓜球很熱門喔！小份 30 元，大份 50 元。", pinyin: "Wǒmen dìguāqiú hěn rèmén ō! Xiǎo fèn sānshí yuán, dà fèn wǔshí yuán.", english: "Our sweet potato balls are really popular! A small portion is 30 NT dollars, large is 50." },
      { speaker: "交換生", chinese: "那我要一份大份的，請問需要等很久嗎？", pinyin: "Nà wǒ yào yí fèn dà fèn de, qǐngwèn xūyào děng hěn jiǔ ma?", english: "I'll get a large portion then — will I need to wait long?" },
      { speaker: "老闆", chinese: "不會，剛出爐的拿好，小心燙喔！", pinyin: "Bú huì, gāng chūlú de ná hǎo, xiǎoxīn tàng ō!", english: "Not at all, here's a fresh batch — careful, it's hot!" },
      { speaker: "交換生", chinese: "好，謝謝老闆！", pinyin: "Hǎo, xièxie lǎobǎn!", english: "Great, thank you!" },
    ],
  },
  {
    id: "cultural-exchange-4",
    categoryId: "cultural-exchange",
    level: 4,
    title: { "zh-TW": "服飾與日常購物結帳", en: "Shopping for Clothes & Checking Out" },
    drink: { liquid: "bubbleTea", ice: true, foam: true, straw: true },
    vocabulary: [
      { chinese: "多少錢", pinyin: "duō shǎo qián", english: "How much is it?" },
      { chinese: "打折", pinyin: "dǎ zhé", english: "Discount" },
      { chinese: "試穿", pinyin: "shì chuān", english: "Try on" },
      { chinese: "尺寸", pinyin: "chǐ cùn", english: "Size" },
      { chinese: "刷卡", pinyin: "shuā kǎ", english: "Pay by credit card" },
      { chinese: "付現", pinyin: "fù xiàn", english: "Pay in cash" },
      { chinese: "便宜", pinyin: "pián yi", english: "Cheap" },
      { chinese: "貴", pinyin: "guì", english: "Expensive" },
    ],
    sentences: [
      { speaker: "店員", chinese: "你好，這件衣服可以試穿喔！", pinyin: "Nǐ hǎo, zhè jiàn yīfu kěyǐ shìchuān ō!", english: "Hi, feel free to try this on!" },
      { speaker: "交換生", chinese: "請問這件有 M 號（尺寸）嗎？", pinyin: "Qǐngwèn zhè jiàn yǒu M hào (chǐcùn) ma?", english: "Do you have this in size M?" },
      { speaker: "店員", chinese: "有的，我拿 M 號給你試穿。滿一千元現在有打九折喔！", pinyin: "Yǒu de, wǒ ná M hào gěi nǐ shìchuān. Mǎn yìqiān yuán xiànzài yǒu dǎ jiǔ zhé ō!", english: "Yes, let me get you a size M to try on. Spend over 1,000 NT dollars and get 10% off right now!" },
      { speaker: "交換生", chinese: "穿起來剛好，那我要買這件。請問可以刷卡嗎？", pinyin: "Chuān qǐlái gānghǎo, nà wǒ yào mǎi zhè jiàn. Qǐngwèn kěyǐ shuākǎ ma?", english: "It fits perfectly, I'll take it. Can I pay by card?" },
      { speaker: "店員", chinese: "可以的，請在這邊感應卡片。", pinyin: "Kěyǐ de, qǐng zài zhèbiān gǎnyìng kǎpiàn.", english: "Sure, please tap your card here." },
    ],
  },
  {
    id: "cultural-exchange-5",
    categoryId: "cultural-exchange",
    level: 5,
    title: { "zh-TW": "台灣傳統與在地節慶", en: "Taiwanese Traditions & Local Festivals" },
    drink: { liquid: "bubbleTea", ice: true, foam: true, straw: true },
    vocabulary: [
      { chinese: "春節 / 農曆新年", pinyin: "chūn jié / nóng lì xīn nián", english: "Chinese New Year" },
      { chinese: "紅包", pinyin: "hóng bāo", english: "Red envelope" },
      { chinese: "端午節", pinyin: "duān wǔ jié", english: "Dragon Boat Festival" },
      { chinese: "粽子", pinyin: "zòng zi", english: "Zongzi (Sticky rice dumplings)" },
      { chinese: "中秋節", pinyin: "zhōng qiū jié", english: "Mid-Autumn Festival" },
      { chinese: "月餅", pinyin: "yuè bǐng", english: "Mooncake" },
      { chinese: "烤肉", pinyin: "kǎo ròu", english: "Barbecue / BBQ" },
      { chinese: "跨年", pinyin: "kuà nián", english: "New Year's Eve celebration" },
    ],
    sentences: [
      { speaker: "同學", chinese: "下個月就是中秋節了，你們國家也有中秋節嗎？", pinyin: "Xià ge yuè jiùshì Zhōngqiūjié le, nǐmen guójiā yě yǒu Zhōngqiūjié ma?", english: "Mid-Autumn Festival is next month — does your country celebrate it too?" },
      { speaker: "交換生", chinese: "我們國家沒有，台灣的中秋節大家都會做什麼呢？", pinyin: "Wǒmen guójiā méiyǒu, Táiwān de Zhōngqiūjié dàjiā dōu huì zuò shénme ne?", english: "We don't have that back home — what do people usually do for Mid-Autumn Festival in Taiwan?" },
      { speaker: "同學", chinese: "我們會和家人朋友一起吃月餅，還會聚在一起烤肉喔！", pinyin: "Wǒmen huì hàn jiārén péngyǒu yìqǐ chī yuèbǐng, hái huì jùzài yìqǐ kǎoròu ō!", english: "We eat mooncakes together with family and friends, and we also get together for a barbecue!" },
      { speaker: "交換生", chinese: "聽起來太棒了！我很期待體驗台灣的烤肉文化。", pinyin: "Tīngqǐlái tài bàng le! Wǒ hěn qídài tǐyàn Táiwān de kǎoròu wénhuà.", english: "That sounds amazing! I'm really looking forward to experiencing Taiwan's barbecue culture." },
    ],
  },
];

// ── Lookup helpers ──────────────────────────────────────────────────────────
// 每個函式都可以傳入自己的 categories/levels 陣列（例如從資料庫抓回來的資料），
// 不傳的話預設用這個檔案裡的 mock 陣列 —— 保持向下相容，也讓 lib/serverData.ts
// 可以直接重複使用這裡已經寫好、測試過的邏輯，不用重複實作一次。

export function getCategory(categoryId: string, categories: ChineseCategory[] = chineseCategories) {
  return categories.find((c) => c.id === categoryId);
}

export function getLevelsForCategory(categoryId: string, levels: ChineseLevel[] = chineseLevels) {
  return levels.filter((l) => l.categoryId === categoryId).sort((a, b) => a.level - b.level);
}

export function getLevel(categoryId: string, level: number, levels: ChineseLevel[] = chineseLevels) {
  return levels.find((l) => l.categoryId === categoryId && l.level === level);
}

/**
 * Resolves what the primary action button on a level page should do:
 * - another level exists in this category → go to it, labeled "Next Level"
 * - this is the last level of a non-final category → back to that category's level list
 * - this is the last level of the last category → back to the 4-category index
 */
export function getLevelNavigation(
  categoryId: string,
  level: number,
  categories: ChineseCategory[] = chineseCategories,
  levels: ChineseLevel[] = chineseLevels
) {
  const categoryIndex = categories.findIndex((c) => c.id === categoryId);
  const levelsInCategory = getLevelsForCategory(categoryId, levels);
  const isLastLevelInCategory = level >= levelsInCategory.length;
  const isLastCategory = categoryIndex === categories.length - 1;

  const prevLevel = level > 1 ? level - 1 : null;
  const nextLevel = !isLastLevelInCategory ? level + 1 : null;

  let finishAction: "next" | "finishCategory" | "finishAll" = "next";
  if (isLastLevelInCategory) finishAction = isLastCategory ? "finishAll" : "finishCategory";

  return { prevLevel, nextLevel, finishAction, totalLevelsInCategory: levelsInCategory.length };
}
