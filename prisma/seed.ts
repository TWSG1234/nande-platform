/**
 * 種子腳本：把目前 lib/data/*.ts 裡「寫死」的內容，搬進資料庫。
 *
 * 公開網站頁面現在會優先讀資料庫（見 lib/serverData.ts），資料庫沒有資料時才會
 * 退回讀這裡搬過去的、或 lib/data/*.ts 本身的內容，兩者是同一份資料的兩個來源，
 * 不會互相矛盾。
 *
 * 執行方式： npm run db:seed
 * 注意：已經存在的資料列不會被這支腳本覆蓋內容（upsert 的 update 是空物件），
 * 只會新增缺少的資料，並且會清掉「不再存在於目前 mockLife.ts 分類清單」裡的
 * 舊生活座標分類（例如改版前的 life-culture），避免舊內容殘留。
 */
import { openPrisma, requireConfirm, describeConfig, loadConfigOrExit } from "./tools/dbClient";
import bcrypt from "bcryptjs";

import { toJsonField, toJsonFieldRequired } from "../lib/jsonFields";
import { campusSpots } from "../lib/data/mockCampus";
import { lifeCategories } from "../lib/data/mockLife";
import { chineseCategories, chineseLevels } from "../lib/data/chineseLearning";
import { calendarEvents } from "../lib/data/mockCalendar";

requireConfirm("db:seed", "會刪除不在內建清單的生活座標分類，並把配色與 IP 角色內容寫回內建版本。", []);
const { prisma } = openPrisma();
console.log("使用的資料庫：" + describeConfig(loadConfigOrExit()).join(" / "));

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "change-this-password";

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] 管理員帳號已存在，略過建立：${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.admin.create({ data: { email, passwordHash, name: "管理員" } });
  console.log(`[seed] 已建立管理員帳號：${email}（密碼請用 .env 裡設定的 ADMIN_PASSWORD 登入，登入後請自行更換）`);
}

async function seedCampus() {
  for (const [i, s] of campusSpots.entries()) {
    await prisma.campusSpot.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        category: s.category === "school-units" ? "school_units" : "culture",
        nameZh: s.name["zh-TW"],
        nameEn: s.name.en,
        descriptionZh: s.description["zh-TW"],
        descriptionEn: s.description.en,
        detailsZh: s.details?.["zh-TW"],
        detailsEn: s.details?.en,
        hoursZh: s.hours?.["zh-TW"],
        hoursEn: s.hours?.en,
        schoolTimes: s.schoolTimes ? JSON.stringify(s.schoolTimes) : null,
        tipsZh: s.tips?.["zh-TW"],
        tipsEn: s.tips?.en,
        mainResponsibilityZh: s.mainResponsibility?.["zh-TW"],
        mainResponsibilityEn: s.mainResponsibility?.en,
        // 這些英文是專案原本就手動寫好的內容，不是系統翻的，標記 MANUAL
        // 避免以後中文被改的時候被自動翻譯覆蓋掉。
        enSource: JSON.stringify({ nameEn: "MANUAL", descriptionEn: "MANUAL", detailsEn: "MANUAL", mainResponsibilityEn: "MANUAL" }),
        exchangeStudentMayEncounter: toJsonField(s.exchangeStudentMayEncounter),
        order: i,
        isPublished: true,
      },
    });
  }
  // 已經 seed 過的資料庫：校園座標的 upsert 不會更新既有資料，所以這裡另外把
  // 升旗／午休的各校時間補進去——只補「還沒有時間資料」的，管理員在後台改過的不動。
  for (const s of campusSpots) {
    if (!s.schoolTimes) continue;
    await prisma.campusSpot.updateMany({
      where: { id: s.id, schoolTimes: null },
      data: { schoolTimes: JSON.stringify(s.schoolTimes) },
    });
  }
  console.log(`[seed] 校園座標：${campusSpots.length} 筆`);
}

async function seedLife() {
  // 2026 生活座標改版：只保留「用餐禮儀／交通／消費」三大分類。舊的
  // "life-culture" 分類（含公筷母筷、垃圾車音樂、綠色乖乖、發票、機車文化）
  // 已經不在 lib/data/mockLife.ts 裡了，但如果資料庫是在改版前 seed 過的，
  // 舊分類與舊項目還留在資料庫裡不會自動消失（upsert 只會新增/略過，不會刪除）。
  // 這裡明確把「不在目前 mockLife.ts 分類清單裡」的舊分類刪除（LifeItem 設定了
  // onDelete: Cascade，分類刪除時底下的項目會一起被刪除），確保資料庫不會殘留
  // 已經說好要移除的舊內容（例如綠色乖乖）。
  const currentCategoryIds = lifeCategories.map((c) => c.id);
  const removed = await prisma.lifeCategory.deleteMany({
    where: { id: { notIn: currentCategoryIds } },
  });
  if (removed.count > 0) {
    console.log(`[seed] 生活座標：清除 ${removed.count} 個已停用的舊分類（例如舊版 life-culture）`);
  }

  let categoryOrder = 0;
  for (const cat of lifeCategories) {
    await prisma.lifeCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        nameZh: cat.name["zh-TW"],
        nameEn: cat.name.en,
        icon: cat.icon,
        descriptionZh: cat.description["zh-TW"],
        descriptionEn: cat.description.en,
        enSource: JSON.stringify({ nameEn: "MANUAL", descriptionEn: "MANUAL" }),
        order: categoryOrder++,
        isPublished: true,
      },
    });

    for (const [i, item] of cat.items.entries()) {
      await prisma.lifeItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          categoryId: cat.id,
          titleZh: item.title["zh-TW"],
          titleEn: item.title.en,
          detailZh: item.detail["zh-TW"],
          detailEn: item.detail.en,
          fullDetailZh: item.fullDetail["zh-TW"],
          fullDetailEn: item.fullDetail.en,
          tipZh: item.tip?.["zh-TW"],
          tipEn: item.tip?.en,
          enSource: JSON.stringify({ titleEn: "MANUAL", detailEn: "MANUAL", fullDetailEn: "MANUAL" }),
          officialLinks: toJsonField(item.officialLinks),
          order: i,
          isPublished: true,
        },
      });
    }
  }
  console.log(`[seed] 生活座標：${lifeCategories.length} 個分類`);
}

async function seedChinese() {
  for (const [i, cat] of chineseCategories.entries()) {
    await prisma.chineseCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        nameZh: cat.nameZh,
        nameEn: cat.nameEn,
        descriptionZh: cat.description["zh-TW"],
        descriptionEn: cat.description.en,
        icon: cat.icon,
        order: i,
        isPublished: true,
      },
    });
  }

  for (const lvl of chineseLevels) {
    await prisma.chineseLevel.upsert({
      where: { id: lvl.id },
      update: {},
      create: {
        id: lvl.id,
        categoryId: lvl.categoryId,
        level: lvl.level,
        titleZh: lvl.title["zh-TW"],
        titleEn: lvl.title.en,
        drink: toJsonFieldRequired(lvl.drink, { liquid: "empty" }),
        vocabulary: toJsonFieldRequired(lvl.vocabulary, []),
        sentences: toJsonFieldRequired(lvl.sentences, []),
        order: lvl.level,
        isPublished: true,
      },
    });
  }
  console.log(`[seed] 中文學習：${chineseCategories.length} 分類、${chineseLevels.length} 關卡`);
}

async function seedCalendar() {
  for (const e of calendarEvents) {
    // date 不是資料庫的唯一鍵（同一天可能有多筆，如補假），用 id 判斷是否已存在。
    await prisma.calendarEvent.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        date: e.date,
        nameZh: e.name["zh-TW"],
        nameEn: e.name.en,
        isHoliday: e.isHoliday,
        isMakeup: e.isMakeup ?? false,
        descriptionZh: e.description["zh-TW"],
        descriptionEn: e.description.en,
        originZh: e.origin?.["zh-TW"],
        originEn: e.origin?.en,
        taiwanCustoms: toJsonField(e.taiwanCustoms),
        sourceZh: e.source?.["zh-TW"],
        sourceEn: e.source?.en,
        tagZh: e.tag?.["zh-TW"],
        tagEn: e.tag?.en,
        isAnchor: e.isAnchor ?? false,
        groupLabelZh: e.groupLabel?.["zh-TW"],
        groupLabelEn: e.groupLabel?.en,
        enSource: JSON.stringify({ nameEn: "MANUAL", descriptionEn: "MANUAL", originEn: "MANUAL", noteEn: "MANUAL" }),
        isOfficial: true, // 全部來自政府行事曆／官方紀念日，種子資料一律鎖定
        isPublished: true,
      },
    });
  }
  console.log(`[seed] 台灣行事曆：${calendarEvents.length} 筆`);
}

async function seedSiteSettings() {
  await prisma.siteSetting.upsert({
    where: { id: "default" },
    // 這次配色是明確要求改掉的（不是「沒有才給預設值」），所以就算資料庫
    // 已經有這筆設定了，也要用 update 把新配色強制寫進去，不能只用空的
    // update: {}（那樣舊安裝的顏色不會被改到）。
    update: {
      primaryColor: "#84bed7",
      secondaryColor: "#2a6ea2",
      buttonColor: "#2a6ea2", // 特別註釋文字顏色
      footerColor: "#FFFFFF",
    },
    create: {
      id: "default",
      siteNameZh: "南得遇見你",
      siteNameEn: "Exchange Compass",
      subtitleZh: "幫助國際交換學生快速適應台灣生活",
      subtitleEn: "Helping international exchange students settle into life in Taiwan",
      contactInfo: "",
      // 演習提醒——原本寫死在 lib/data/drillNotice.ts，搬進資料庫讓管理員可以編輯，
      // 內容跟原本一字不差，改版當下不會有任何使用者看到的變化。
      drillTitleZh: "演習提醒",
      drillTitleEn: "Drill Reminder",
      drillBodyZh:
        "8/5～8/14 為漢光42號演習期間，其中 8/7～8/13 各地將分區實施城鎮韌性（防空）演習，期間可能有警報測試、人車管制，請留意官方公告與所在地區時段。",
      drillBodyEn:
        "Aug 5–14 is the Han Kuang No. 42 exercise period, with the City Resilience (air defense) drill held region-by-region across Aug 7–13 — expect alarm tests and brief traffic/pedestrian control. Please follow official announcements for your area's exact time slot.",
      drillGeneralBodyZh: "7、8 月為台灣演習與防災宣導較密集的時期，請留意學校及官方公告。",
      drillGeneralBodyEn:
        "July and August are Taiwan's busiest months for civil-defense drills and preparedness campaigns — please keep an eye on notices from your school and official announcements.",
      drillStart: "2026-08-05",
      drillEnd: "2026-08-14",
    },
  });
  console.log("[seed] 網站基本設定：已建立預設值");
}

// 修復公告前後台資料連結問題時發現：首頁輪播原本除了讀 Announcement 資料表，
// 還會另外混入 lib/data/fallbackAnnouncements.ts 這四則寫死的內容——後台看
// 不到、也管不到這幾則，這正是「前台看得到、後台看不到」的原因。現在首頁
// 輪播只讀 Announcement 資料表了，所以把這四則原本會顯示的內容搬進資料庫，
// 確保修好資料連結之後，首頁不會突然少了原本看得到的內容；搬進來之後
// 管理員就可以在 /admin/announcements 正常編輯/停用/刪除它們。
async function seedAnnouncements() {
  const items = [
    {
      id: "fallback-chinese",
      title: { "zh-TW": "想更快適應台灣生活？", en: "Want to settle into Taiwan life faster?" },
      body: {
        "zh-TW": "可以到中文學習區練習日常用語，從打招呼到點餐，一關一關累積實用中文！",
        en: "Head to the Chinese Learning area to practice everyday phrases — from greetings to ordering food, one level at a time.",
      },
    },
    {
      id: "fallback-life",
      title: { "zh-TW": "生活小提醒", en: "Everyday tip" },
      body: {
        "zh-TW": "最近沒有連假，不妨趁空檔逛逛生活座標，了解台灣街頭巷尾的小文化！",
        en: "No long weekend on the horizon — a good time to browse the Life Guide and pick up a few everyday Taiwan customs.",
      },
    },
    {
      id: "fallback-campus",
      title: { "zh-TW": "校園生活小知識", en: "Campus life, explained" },
      body: {
        "zh-TW": "還在好奇台灣校園的升旗、打掃、制服是怎麼回事嗎？校園座標都幫你整理好了。",
        en: "Curious about flag-raising, school cleaning duty, or uniforms? The Campus Guide breaks it all down.",
      },
    },
    {
      id: "fallback-calendar",
      title: { "zh-TW": "先規劃你的下一個連假", en: "Plan ahead for your next long weekend" },
      body: {
        "zh-TW": "打開台灣行事曆，提前看看接下來的國定假日，安排你的旅遊或休息時間。",
        en: "Check the Taiwan Calendar to see upcoming public holidays and start planning your next trip or rest day.",
      },
    },
  ];

  for (const [i, item] of items.entries()) {
    await prisma.announcement.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        type: "permanent",
        order: i,
        titleZh: item.title["zh-TW"],
        titleEn: item.title.en,
        contentZh: item.body["zh-TW"],
        contentEn: item.body.en,
        enSource: JSON.stringify({ titleEn: "MANUAL", contentEn: "MANUAL" }),
        isPublished: true,
        publishDate: new Date(),
      },
    });
  }
  console.log(`[seed] 首頁公告：搬移 ${items.length} 則常駐公告進資料庫`);

  // 節假日公告範例——示範用，管理員可以到 /admin/announcements 直接編輯或刪除。
  await prisma.announcement.upsert({
    where: { id: "holiday-mid-autumn-2026" },
    update: {},
    create: {
      id: "holiday-mid-autumn-2026",
      type: "holiday",
      order: 0,
      titleZh: "2026 中秋節放假通知",
      titleEn: "2026 Mid-Autumn Festival Holiday Notice",
      contentZh: "中秋節連假期間行政單位暫停服務，祝大家佳節愉快，出遊平安！",
      contentEn: "Administrative offices will be closed during the Mid-Autumn Festival long weekend. Happy holidays and safe travels!",
      enSource: JSON.stringify({ titleEn: "MANUAL", contentEn: "MANUAL" }),
      startDate: new Date("2026-09-25"),
      endDate: new Date("2026-09-27"),
      relatedHoliday: "中秋節",
      isPublished: true,
      publishDate: new Date(),
    },
  });
  console.log("[seed] 首頁公告：建立 1 則節假日公告範例（2026 中秋節）");
}

// IP 角色身分卡——三隻角色的顏色都是從各自的卡牌圖片本身算出來的（背景色=
// 卡牌底色的淺色版，框線色=卡牌裡最深的代表色），不是隨便配色，也不是三隻
// 共用同一套。角色圖片（正面）暫時跟卡牌圖（背面）用同一張圖——目前只有
// 卡牌美術，還沒有另外的正面人物照，管理員之後可以到 /admin/characters
// 個別上傳正面照片替換掉。名字是暫時性的佔位名稱，等你提供正式名稱後
// 到後台直接改掉即可。
async function seedIpCharacters() {
  // 三隻角色跟卡牌圖片的對應，是照角色故事跟圖片內容比對出來的：
  // 帕菲 Puffy＝雲朵/蓬鬆意象（紫色卡，底部有雲）、威洛 Waylo＝機器人/科技
  // 導航意象（藍色卡，星芒天線像雷達）、布迪 Budi＝植物新芽意象（黃綠色卡，
  // 上面就是新芽圖案，跟「以植物與新芽為設計靈感」完全對應）。
  const characters = [
    {
      id: "ip-character-a",
      name: "帕菲 Puffy",
      image: "/uploads/content/ip-front-puffy.png",
      backImage: "/uploads/content/ip-card-back-a-v2.png",
      backImageWidth: 720,
      backImageHeight: 1006,
      bgColor: "#EFEBF5",
      borderColor: "#5B4082",
      textColor: "#35254B",
      accentColor: "#F6D8C6",
      order: 1,
      positionZh: "生活中的陪伴者，帶大家發現台灣日常中有趣的小事。",
      positionEn: "A companion for everyday life, helping everyone discover the little joys of daily life in Taiwan.",
      personalityZh: "隨和、放鬆、喜歡新奇事物，總是用輕鬆的態度面對生活。",
      personalityEn: "Easygoing and relaxed, curious about new things, and always facing life with a laid-back attitude.",
      quoteZh: "放輕鬆，慢慢探索生活！",
      quoteEn: "Relax, and explore life at your own pace!",
      homePosition: "characterC",
      dialogueLines: [
        { zh: "你好！我是帕菲，很高興認識你！", en: "Hi! I'm Puffy, nice to meet you!" },
        { zh: "今天也一起探索台灣吧！", en: "Let's explore Taiwan together today too!" },
        { zh: "你今天過得怎麼樣？", en: "How's your day going?" },
        { zh: "慢慢來，一起發現生活中的小驚喜吧！", en: "Take it slow — let's find little surprises in everyday life together!" },
      ],
      conceptTitleZh: "生活與陪伴",
      conceptTitleEn: "Life & Companionship",
      introZh:
        "以蓬鬆柔軟的雲朵為設計靈感，呈現輕鬆、自在與溫暖的氛圍。代表享受生活、樂於體驗新事物的生活夥伴。希望透過輕鬆隨和的形象，陪伴外籍學生探索台灣的日常生活，從平凡的小事中發現不同文化的美好。",
      introEn:
        "Inspired by soft, fluffy clouds, Puffy brings a relaxed, easygoing, and warm atmosphere. Puffy represents a life companion who enjoys everyday moments and is always open to new experiences. With a laid-back presence, Puffy accompanies international students as they explore daily life in Taiwan, finding beauty in cultural differences through small, everyday moments.",
    },
    {
      id: "ip-character-b",
      name: "威洛 Waylo",
      image: "/uploads/content/ip-front-waylo.png",
      backImage: "/uploads/content/ip-card-back-b-v2.png",
      backImageWidth: 720,
      backImageHeight: 1006,
      bgColor: "#DBF0FB",
      borderColor: "#2161A1",
      textColor: "#13385D",
      accentColor: "#F9F0BF",
      order: 2,
      positionZh: "團隊中的引導者，在陌生環境中提供方向與協助。",
      positionEn: "The guide of the team, offering direction and support in unfamiliar surroundings.",
      personalityZh: "友好、有責任感、樂於幫助他人。",
      personalityEn: "Friendly, responsible, and always ready to help others.",
      quoteZh: "有我在，一起找到方向！",
      quoteEn: "I've got you — let's find the way together!",
      homePosition: "characterB",
      dialogueLines: [
        { zh: "嗨，我是威洛！", en: "Hey, I'm Waylo!" },
        { zh: "有任何不知道怎麼辦的事，都可以來問我！", en: "Whenever you're not sure what to do, just come find me!" },
        { zh: "一起找到方向，一步都不會走丟！", en: "Let's find the way together — you won't get lost!" },
      ],
      conceptTitleZh: "引導與協助",
      conceptTitleEn: "Guidance & Support",
      introZh:
        "以機器人為設計靈感，結合科技與導航的概念，象徵方向、資訊與可靠的陪伴。代表友善且樂於助人的引導者，協助外籍學生認識陌生的環境、尋找所需資訊，讓來台生活的每一步都更加安心與順利。",
      introEn:
        "Inspired by robots, Waylo blends technology and navigation to symbolize direction, information, and reliable companionship. Waylo represents a friendly, helpful guide who assists international students in getting to know unfamiliar surroundings and finding the information they need, making every step of life in Taiwan feel more secure and smooth.",
    },
    {
      id: "ip-character-c",
      name: "布迪 Budi",
      image: "/uploads/content/ip-front-budi.png",
      backImage: "/uploads/content/ip-card-back-c-v2.png",
      backImageWidth: 720,
      backImageHeight: 1006,
      bgColor: "#FCF9D8",
      // 布迪 Budi 專屬配色——只有這隻角色用，不套用到帕菲/威洛，也不影響
      // 全站主色/輔色。
      borderColor: "#df8807",
      textColor: "#9F4424",
      accentColor: "#F5CA85",
      order: 0,
      positionZh: "初來乍到的探索者，陪伴大家認識台灣、適應新環境。",
      positionEn: "A newcomer explorer, helping everyone get to know Taiwan and settle into a new environment.",
      personalityZh: "好奇、認真、喜歡探索，願意一步一步學習新事物。",
      personalityEn: "Curious and earnest, loves exploring, and is always willing to learn new things step by step.",
      quoteZh: "一步一步，探索新的生活！",
      quoteEn: "Step by step, exploring a new life!",
      homePosition: "characterA",
      dialogueLines: [
        { zh: "嗨！我是布迪！", en: "Hi there, I'm Budi!" },
        { zh: "一起探索新的地方吧！", en: "Let's explore somewhere new together!" },
        { zh: "一步一步認識台灣！", en: "Getting to know Taiwan, one step at a time!" },
      ],
      conceptTitleZh: "成長與探索",
      conceptTitleEn: "Growth & Exploration",
      introZh:
        "以植物與新芽為設計靈感，象徵成長、希望與嶄新的開始。代表初次踏入陌生環境、對世界充滿好奇的探索者。透過一步一腳印的學習與體驗，逐漸適應台灣的生活，象徵每一位外籍學生在異鄉成長的過程。",
      introEn:
        "Inspired by plants and new sprouts, Budi symbolizes growth, hope, and fresh beginnings. Budi represents an explorer stepping into unfamiliar surroundings for the first time, full of curiosity about the world. Through steady, step-by-step learning and experience, Budi gradually settles into life in Taiwan — symbolizing the growth journey of every international student abroad.",
    },
  ];

  for (const c of characters) {
    await prisma.ipCharacter.upsert({
      where: { id: c.id },
      // 這次的角色資料是明確要求更新的正式內容，不是「沒有才給預設值」，
      // 所以用 update 把新內容強制寫進去，跟 seedSiteSettings 的配色一樣邏輯。
      update: {
        name: c.name,
        image: c.image, // 身分證正面大頭照
        backImage: c.backImage, // 身分證背面卡牌圖（含原始寬高，前台用來維持比例）
        backImageWidth: c.backImageWidth,
        backImageHeight: c.backImageHeight,
        positionZh: c.positionZh,
        positionEn: c.positionEn,
        personalityZh: c.personalityZh,
        personalityEn: c.personalityEn,
        quoteZh: c.quoteZh,
        quoteEn: c.quoteEn,
        conceptTitleZh: c.conceptTitleZh,
        conceptTitleEn: c.conceptTitleEn,
        introZh: c.introZh,
        introEn: c.introEn,
        borderColor: c.borderColor,
        textColor: c.textColor,
        homePosition: c.homePosition,
        order: c.order, // IP 角色頁的身分證顯示順序：布迪 → 帕菲 → 威洛（只改排序欄位，id 不動）
        enSource: JSON.stringify({
          introEn: "MANUAL",
          positionEn: "MANUAL",
          personalityEn: "MANUAL",
          quoteEn: "MANUAL",
          conceptTitleEn: "MANUAL",
        }),
      },
      create: {
        id: c.id,
        name: c.name,
        image: c.image,
        introZh: c.introZh,
        introEn: c.introEn,
        positionZh: c.positionZh,
        positionEn: c.positionEn,
        personalityZh: c.personalityZh,
        personalityEn: c.personalityEn,
        quoteZh: c.quoteZh,
        quoteEn: c.quoteEn,
        conceptTitleZh: c.conceptTitleZh,
        conceptTitleEn: c.conceptTitleEn,
        backImage: c.backImage,
        backImageWidth: c.backImageWidth,
        backImageHeight: c.backImageHeight,
        bgColor: c.bgColor,
        borderColor: c.borderColor,
        textColor: c.textColor,
        accentColor: c.accentColor,
        homePosition: c.homePosition,
        enSource: JSON.stringify({
          introEn: "MANUAL",
          positionEn: "MANUAL",
          personalityEn: "MANUAL",
          quoteEn: "MANUAL",
          conceptTitleEn: "MANUAL",
        }),
        order: c.order,
        isVisible: true,
      },
    });

    // 對話回覆：只有這隻角色「還沒有任何回覆」時才建立預設的幾句；已經有的話
    // （管理員在後台編輯過）不要動，避免重跑 seed 把後台改好的台詞洗掉。
    const existingLines = await prisma.ipDialogueLine.count({ where: { characterId: c.id } });
    if (existingLines === 0) {
      await prisma.ipDialogueLine.createMany({
        data: c.dialogueLines.map((line, i) => ({
          characterId: c.id,
          textZh: line.zh,
          textEn: line.en,
          order: i,
          isEnabled: true,
        })),
      });
    }
  }
  console.log(`[seed] IP角色身分卡：更新 ${characters.length} 隻角色（帕菲 Puffy／威洛 Waylo／布迪 Budi）的中英文內容與對話回覆`);
}

// 中文學習 2.0 的種子資料——生活/校園各 5 關，先都建立「空白入口」，只有
// 「校園第四關」這次要求要有實際內容（小漫畫→單字→填空題 三個學習頁）。
async function seedChineseStages() {
  for (const track of ["life", "campus"] as const) {
    for (let levelNumber = 1; levelNumber <= 8; levelNumber++) {
      const id = `chinese-stage-${track}-${levelNumber}`;
      await prisma.chineseStage.upsert({
        where: { id },
        update: {},
        create: {
          id,
          track,
          levelNumber,
          order: levelNumber,
          isPublished: true,
        },
      });
    }
  }

  // 校園第四關：漫畫（先留空、圖片之後補）→ 單字（9 個） → 填空題（先留空）
  const stageId = "chinese-stage-campus-4";

  const comicPage = await prisma.chinesePage.upsert({
    where: { id: "chinese-page-campus-4-comic" },
    update: {},
    create: {
      id: "chinese-page-campus-4-comic",
      stageId,
      type: "comic",
      order: 0,
      isPublished: true,
      comicImages: "[]", // 漫畫圖片之後由管理員上傳，先留空陣列，不是寫死佔位圖
    },
  });

  const vocabPage = await prisma.chinesePage.upsert({
    where: { id: "chinese-page-campus-4-vocab" },
    update: {},
    create: {
      id: "chinese-page-campus-4-vocab",
      stageId,
      type: "vocabulary",
      order: 1,
      isPublished: true,
    },
  });

  const blankPage = await prisma.chinesePage.upsert({
    where: { id: "chinese-page-campus-4-blank" },
    update: {},
    create: {
      id: "chinese-page-campus-4-blank",
      stageId,
      type: "fill_blank",
      order: 2,
      isPublished: true,
    },
  });

  const choicePage = await prisma.chinesePage.upsert({
    where: { id: "chinese-page-campus-4-choice" },
    update: {},
    create: {
      id: "chinese-page-campus-4-choice",
      stageId,
      type: "multiple_choice",
      order: 3,
      isPublished: true,
    },
  });

  const words = [
    { hanzi: "保健室", pinyin: "bǎo jiàn shì", english: "Health center / Nurse's office" },
    { hanzi: "看醫生", pinyin: "kàn yī shēng", english: "See a doctor" },
    { hanzi: "診所", pinyin: "zhěn suǒ", english: "Clinic" },
    { hanzi: "感冒", pinyin: "gǎn mào", english: "Catch a cold" },
    { hanzi: "發燒", pinyin: "fā shāo", english: "Have a fever" },
    { hanzi: "頭痛", pinyin: "tóu tòng", english: "Headache" },
    { hanzi: "拉肚子", pinyin: "lā dù zi", english: "Diarrhea" },
    { hanzi: "咳嗽", pinyin: "ké sou", english: "Cough" },
    { hanzi: "吃藥", pinyin: "chī yào", english: "Take medicine" },
  ];
  for (const [i, w] of words.entries()) {
    await prisma.chineseVocabWord.upsert({
      where: { id: `chinese-word-campus-4-${i}` },
      update: {},
      create: {
        id: `chinese-word-campus-4-${i}`,
        pageId: vocabPage.id,
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        english: w.english,
        order: i,
      },
    });
  }

  // 填空題——照你給的例子直接建兩題，可以實際測試輸入判定。
  const blanks = [
    { en: "I have a fever.", zh: "我發燒了。", blank: "發燒" },
    { en: "Have a headache", zh: "我頭痛。", blank: "頭痛" },
  ];
  for (const [i, b] of blanks.entries()) {
    await prisma.chineseQuestion.upsert({
      where: { id: `chinese-q-campus-4-blank-${i}` },
      update: {},
      create: {
        id: `chinese-q-campus-4-blank-${i}`,
        pageId: blankPage.id,
        questionType: "fill_blank",
        promptEn: b.en,
        promptZh: b.zh,
        answerData: JSON.stringify({ blank: b.blank, acceptableAnswers: [] }),
        order: i,
        isPublished: true,
      },
    });
  }

  // 選擇題——照你給的例子建一題，正確答案用內容比對，不是用位置。
  await prisma.chineseQuestion.upsert({
    where: { id: "chinese-q-campus-4-choice-0" },
    update: {},
    create: {
      id: "chinese-q-campus-4-choice-0",
      pageId: choicePage.id,
      questionType: "multiple_choice",
      promptZh: "哪一個是「保健室」？",
      answerData: JSON.stringify({ options: ["保健室", "教室", "餐廳"], correctAnswer: "保健室" }),
      order: 0,
      isPublished: true,
    },
  });

  void comicPage;
  console.log("[seed] 中文學習 2.0：建立生活/校園各 5 關，校園第四關已放入漫畫/單字（9 個）/填空題（2 題）/選擇題（1 題）四個學習頁");
}

async function main() {
  await seedAdmin();
  await seedCampus();
  await seedLife();
  await seedChinese();
  await seedChineseStages();
  await seedCalendar();
  await seedSiteSettings();
  await seedAnnouncements();
  await seedIpCharacters();
  console.log("[seed] 完成。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
