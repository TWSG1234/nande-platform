import { LifeCategory } from "@/lib/types";

// 資料整理原則（2026 改版）：
// - 生活座標只保留三大分類：用餐禮儀／交通／消費，「綠色乖乖」與不屬於這三類的
//   舊內容（垃圾車音樂、機車文化）已完全移除。
// - 交通與消費類的班次、票價、費率一律不寫死，只說明「這是什麼、什麼情況用、去哪查」，
//   實際數字請使用者自行到官方連結查詢（見各卡片的 officialLinks）。
// - 文化類內容（合菜、公筷母匙、用餐禁忌）採用保守、有依據的說法，避免把個別習慣
//   誇大成「所有人都這樣」或「法律規定」。
export const lifeCategories: LifeCategory[] = [
  {
    id: "dining-etiquette",
    name: { "zh-TW": "用餐禮儀", en: "Dining Etiquette" },
    icon: "UtensilsCrossed",
    description: {
      "zh-TW": "在台灣多人用餐時，會遇到的分享文化與小習慣。",
      en: "Shared-dining customs and small habits you'll encounter when eating with others in Taiwan.",
    },
    items: [
      {
        id: "shared-dishes",
        title: { "zh-TW": "合菜", en: "Shared Dishes" },
        detail: {
          "zh-TW": "多人聚餐時，菜餚通常放在桌子中央大家一起分享，和「各自點一份」不太一樣。",
          en: "At group meals, dishes are usually placed in the center of the table for everyone to share — different from ordering an individual meal.",
        },
        fullDetail: {
          "zh-TW":
            "在台灣，許多家庭聚餐、朋友聚餐或餐廳多人用餐時，常會採用「合菜」的方式——一桌準備多道不同菜色，放在桌子中央，讓大家一起分享、各自夾取。這與「每個人各自點一份、各自吃自己餐點」的方式不太一樣：在許多西式餐飲情境中，較常見每人各自點一份主餐；台灣中式餐廳則常見多人共享多道菜餚。不過這並不是所有餐廳或每一餐都一定如此，實際用餐方式仍會依場合與餐廳類型而不同。",
          en:
            "In Taiwan, family gatherings, meals with friends, and group dining at restaurants often follow a \"shared dishes\" style: several dishes are placed in the center of the table, and everyone helps themselves. This differs somewhat from ordering an individual meal that only you eat — in many Western dining contexts, it's more common for each person to order their own main dish, while Taiwanese-style restaurants often feature multiple shared dishes for the whole table. That said, this isn't true of every restaurant or every meal; the actual style still depends on the occasion and type of restaurant.",
        },
        tip: {
          "zh-TW": "如果第一次跟台灣朋友一起吃飯，可以先觀察大家怎麼分菜、夾菜，再自然地加入。",
          en: "If it's your first time eating with Taiwanese friends, it can help to watch how everyone serves and shares food before joining in.",
        },
      },
      {
        id: "serving-chopsticks",
        title: { "zh-TW": "公筷母匙", en: "Serving Chopsticks and Spoons" },
        detail: {
          "zh-TW": "多人共享菜餚時，用公筷或母匙把食物夾到自己碗中，減少個人餐具直接接觸共同菜餚。",
          en: "When sharing dishes, using a serving chopstick or spoon to move food to your own bowl avoids touching shared dishes directly with your personal utensils.",
        },
        fullDetail: {
          "zh-TW":
            "「公筷母匙」是指多人共享菜餚時，額外準備一副公用的筷子（公筷）或湯匙（母匙），專門用來把食物從共同的盤子夾到自己的碗裡，再用自己的餐具進食。簡單來說：「公筷＝夾取共同菜餚」，「自己的筷子＝吃自己碗裡的食物」。多人一起用餐時使用公筷母匙，有助於降低口腔細菌透過共同餐具或共食傳播的風險。這是一種建議的衛生習慣，而不是強制規定，實際是否使用會依家庭、餐廳與個人習慣而不同。",
          en:
            "\"Serving chopsticks and spoons\" (公筷母匙) refers to an extra set of chopsticks or a spoon set aside during group meals, used only to move food from a shared dish into your own bowl — after which you eat with your own chopsticks. Put simply: the serving utensils are for taking food from shared dishes, and your own chopsticks are for eating from your own bowl. Using serving utensils when dining together helps reduce the risk of spreading oral bacteria through shared utensils or communal eating. This is a recommended hygiene habit rather than a strict rule, and whether it's used varies by household, restaurant, and personal habit.",
        },
        tip: {
          "zh-TW": "如果餐桌上有提供公筷母匙，可以優先用它們夾菜，再用自己的筷子吃飯。",
          en: "If serving chopsticks or a serving spoon are provided at the table, it's a good habit to use them to take food before eating with your own chopsticks.",
        },
      },
      {
        id: "dining-taboos",
        title: { "zh-TW": "用餐禁忌", en: "Dining Taboos" },
        detail: {
          "zh-TW": "傳統文化中，把筷子直插在飯上通常被視為不禮貌，因為讓人聯想到祭拜插香。",
          en: "In traditional culture, sticking chopsticks upright into rice is generally seen as impolite, since it resembles incense used in ancestral offerings.",
        },
        fullDetail: {
          "zh-TW":
            "在台灣傳統文化中，將筷子直直插在一碗飯上通常被視為不禮貌或不吉利的行為，原因是這個樣子與傳統祭祀中插香的形式相似，容易讓人聯想到祭拜先人，因此一般用餐場合會盡量避免。需要說明的是，這是一種文化上的用餐習俗與禁忌，並不是法律規定的事項。",
          en:
            "In traditional Taiwanese culture, sticking chopsticks upright into a bowl of rice is generally considered impolite or unlucky, because it resembles incense sticks placed upright during ancestral worship, which can evoke associations with offerings to the deceased. Because of this, it's usually avoided during ordinary meals. It's worth noting this is a cultural dining custom and taboo, not a legal rule.",
        },
        tip: {
          "zh-TW": "吃飯時如果暫時不用筷子，可以將筷子平放在筷架或餐具放置處，不要直插在飯中。",
          en: "If you're not using your chopsticks for a moment, rest them flat on a chopstick rest or the table setting instead of sticking them into your rice.",
        },
      },
    ],
  },
  {
    id: "transportation",
    name: { "zh-TW": "交通", en: "Transportation" },
    icon: "Bus",
    description: {
      "zh-TW": "剛到台灣時常會用到的大眾運輸方式，以及去哪裡查最新資訊。",
      en: "The public transportation options you'll use most as a newcomer, and where to check current information.",
    },
    items: [
      {
        id: "bus",
        title: { "zh-TW": "公車", en: "Bus" },
        detail: {
          "zh-TW": "城市與地區間常見的大眾運輸工具，適合短程或城市內移動，路線與付款方式依業者而不同。",
          en: "A common form of public transportation for short trips or getting around within a city; routes and payment methods vary by operator.",
        },
        fullDetail: {
          "zh-TW":
            "公車是台灣城市與地區之間很常見的大眾運輸工具，適合短程移動或城市內的日常通勤。不同城市、縣市會有不同的公車路線與經營業者，搭車前建議先確認路線、方向與站牌位置。部分路線可以使用電子票證或其他電子支付方式，但實際可用的支付方式會依路線與業者規定而不同，建議上車前或詢問司機確認。如果需要即時到站資訊，也可以視需要下載「iBus 公路客運」APP 查詢（非必要安裝）。",
          en:
            "Buses are a common form of public transportation between and within Taiwan's cities and counties, suitable for short trips or everyday commuting within a city. Different cities and counties have their own bus routes and operators, so it's a good idea to check the route, direction, and bus stop before boarding. Some routes accept contactless transit cards or other electronic payment methods, but accepted payment methods vary by route and operator — it's best to confirm before boarding or ask the driver. For real-time arrival information, you can also optionally install the \"iBus\" app (not required).",
        },
        officialLinks: [
          {
            url: "https://www.taiwanbus.tw/eBUSPage/Default.aspx",
            label: { "zh-TW": "查詢公車／客運路線", en: "Find Bus & Intercity Routes" },
          },
        ],
      },
      {
        id: "train",
        title: { "zh-TW": "火車", en: "Train (TRA)" },
        detail: {
          "zh-TW": "台灣鐵路（臺鐵）適合城市之間的移動，有不同車種，實際班次與票價請以官方查詢系統為準。",
          en: "Taiwan Railway (TRA) is suited to travel between cities, with several train types available — always check the official system for current schedules and fares.",
        },
        fullDetail: {
          "zh-TW":
            "臺鐵（台灣鐵路）適合台灣各城市之間的移動，可以往返不同縣市，並有多種不同車種可以選擇。搭車前建議先確認出發站、抵達站、日期與時間，部分車次需要事先訂票。由於實際班次與票價可能隨時調整，請以臺鐵官方查詢系統的即時資訊為準，不要依賴固定班次資料規劃行程。",
          en:
            "Taiwan Railway (TRA) is a convenient way to travel between different cities and counties in Taiwan, with several train types to choose from. Before traveling, it's a good idea to confirm your departure station, destination station, date, and time — some trains require advance booking. Because schedules and fares can change, always check TRA's official system for up-to-date information rather than relying on a fixed timetable.",
        },
        officialLinks: [
          {
            url: "https://www.railway.gov.tw/",
            label: { "zh-TW": "臺鐵時刻／車次查詢", en: "TRA Timetable & Ticket Search" },
          },
        ],
      },
      {
        id: "youbike",
        title: { "zh-TW": "公共自行車", en: "Public Bikes (YouBike)" },
        detail: {
          "zh-TW": "YouBike 是台灣常見的公共自行車系統，可在設站地區租借與歸還，實際費率依當地與官方最新資訊為準。",
          en: "YouBike is a common public bike-sharing system in Taiwan — rent and return at stations, with fees and rules varying by area.",
        },
        fullDetail: {
          "zh-TW":
            "YouBike 是台灣常見的公共自行車租借系統，在設有站點的地區，使用者可以在站點租借自行車，騎乘後再到可還車的站點歸還。可以透過官方網站或 App 查詢附近站點與目前的車輛狀況。實際的租借方式、費率與會員規定會依地區與官方最新公告而不同，建議以官方資訊為準，不要假設全台灣都適用相同的規則或費用。",
          en:
            "YouBike is a common public bike-sharing system in Taiwan. In areas with YouBike stations, users can rent a bike at one station and return it at another that accepts returns. You can check nearby stations and current bike availability through the official website or app. Actual rental methods, fees, and membership rules vary by area and are subject to official updates, so check official information rather than assuming the same rules or pricing apply everywhere in Taiwan.",
        },
        officialLinks: [
          { url: "https://www.youbike.com.tw/", label: { "zh-TW": "YouBike 官方網站", en: "YouBike Official Website" } },
          {
            url: "https://www.youbike.com.tw/region/main/stations/list/",
            label: { "zh-TW": "查詢附近站點", en: "Find Nearby Stations" },
          },
        ],
      },
      {
        id: "hsr",
        title: { "zh-TW": "高鐵", en: "High Speed Rail (THSR)" },
        detail: {
          "zh-TW": "台灣高鐵適合西部主要城市間的快速移動，實際班次與票價請以官方網站查詢，不要參考固定時刻表。",
          en: "Taiwan High Speed Rail (THSR) is suited to fast travel between major western cities — check the official website for current schedules and fares.",
        },
        fullDetail: {
          "zh-TW":
            "台灣高鐵主要用於台灣西部主要城市之間的快速移動，適合較長距離的城市間移動。搭車前可以透過官方網站查詢班次、票價與停靠站資訊。由於班次與票價可能調整，請以台灣高鐵官方網站上的即時查詢結果為準，不要依賴固定的時刻表資料規劃行程。",
          en:
            "Taiwan High Speed Rail (THSR) is mainly used for fast travel between major cities along Taiwan's western corridor, suited to longer-distance city-to-city trips. Before traveling, you can check schedules, fares, and stops through the official website. Because schedules and fares are subject to change, rely on THSR's official real-time search results rather than a fixed timetable when planning your trip.",
        },
        officialLinks: [
          {
            url: "https://www.thsrc.com.tw/",
            label: { "zh-TW": "台灣高鐵時刻／票價查詢", en: "THSR Timetable & Fare Search" },
          },
        ],
      },
      {
        id: "metro",
        title: { "zh-TW": "捷運", en: "Metro (MRT)" },
        detail: {
          "zh-TW": "部分台灣城市有捷運系統，方便城市內移動；南台灣以高雄捷運為主，可查詢路線、時刻與轉乘資訊。",
          en: "Some Taiwanese cities have metro systems for getting around within the city; in southern Taiwan this mainly means the Kaohsiung MRT.",
        },
        fullDetail: {
          "zh-TW":
            "目前台灣部分城市設有捷運或都市軌道系統，是城市內移動時很方便的大眾運輸工具。搭乘前可以先查看路線圖，若需要轉乘，也要留意轉乘站與行駛方向，並可利用官方網站查詢路線、車站、票價與首末班車資訊。「南得遇見你」特別關注南台灣，因此優先介紹高雄捷運：可以透過官方網站查詢營運路線圖、各車站資訊、時刻表、首末班車與轉乘資訊。台灣不同城市的捷運系統由不同單位營運，如果你所在的城市不是高雄，請使用當地捷運公司的官方網站查詢（例如台北捷運）。",
          en:
            "Some cities in Taiwan currently have metro or urban rail systems, which are a convenient way to get around within a city. Before riding, it helps to check the route map, and if you need to transfer, pay attention to the transfer station and direction of travel; the official website can also tell you about routes, stations, fares, and first/last train times. Because Taiwan Compass focuses on southern Taiwan, we highlight the Kaohsiung MRT here: its official website covers the route map, station information, timetables, first/last trains, and transfer information. Different cities in Taiwan have their metro systems run by different operators, so if you're not in Kaohsiung, check the official website of your local metro company instead (for example, Taipei MRT).",
        },
        officialLinks: [
          { url: "https://www.krtc.com.tw/", label: { "zh-TW": "高雄捷運官方網站", en: "Kaohsiung MRT Official Website" } },
          { url: "https://web.metro.taipei/", label: { "zh-TW": "台北捷運官方網站", en: "Taipei MRT Official Website" } },
        ],
      },
    ],
  },
  {
    id: "consumption",
    name: { "zh-TW": "消費", en: "Shopping & Payments" },
    icon: "Receipt",
    description: {
      "zh-TW": "在台灣消費時會遇到的發票制度與電子發票儲存方式。",
      en: "The invoice system and e-invoice storage tools you'll encounter when shopping in Taiwan.",
    },
    items: [
      {
        id: "invoice",
        title: { "zh-TW": "發票", en: "Uniform Invoice" },
        detail: {
          "zh-TW": "台灣消費常見「統一發票」，可作為交易憑證並定期對獎；現在也有電子發票，不一定會印成紙本。",
          en: "Taiwan's \"uniform invoice\" serves as a transaction record with a periodic lottery — many are now electronic and not always printed on paper.",
        },
        fullDetail: {
          "zh-TW":
            "在台灣購買商品或服務時，符合規定的交易通常會開立「統一發票」，可以作為交易與稅務管理的重要憑證。台灣的統一發票也有定期開獎制度，消費者可以憑發票號碼對獎。需要注意的是，現在有許多消費會開立電子發票或雲端發票，發票不一定會印成紙本，實際開立方式會依店家與消費情況而不同。",
          en:
            "When you buy goods or services in Taiwan, qualifying transactions typically issue a \"uniform invoice\" (統一發票), which serves as an important record for the transaction and for tax purposes. Taiwan's uniform invoices also have a periodic lottery, letting shoppers check their invoice numbers for prizes. It's worth noting that many purchases now issue electronic or cloud invoices instead — an invoice isn't always printed on paper, and the actual format depends on the store and the transaction.",
        },
        officialLinks: [
          { url: "https://www.einvoice.nat.gov.tw/", label: { "zh-TW": "電子發票官方平台", en: "Official E-Invoice Platform" } },
        ],
      },
      {
        id: "carrier",
        title: { "zh-TW": "載具", en: "E-invoice Carrier" },
        detail: {
          "zh-TW": "載具可以用來儲存電子發票，例如手機條碼、悠遊卡、一卡通等，完成設定後就能集中管理與對獎。",
          en: "A \"carrier\" is a tool for storing your e-invoices — such as a mobile barcode or transit card — once set up, so you can manage and check them in one place.",
        },
        fullDetail: {
          "zh-TW":
            "「載具」是用來儲存電子發票的工具，符合規定並完成設定／歸戶的載具，可以用來儲存電子發票。常見的載具包含手機條碼、悠遊卡、一卡通、icash，以及部分信用卡／簽帳金融卡等。其中，「手機條碼」是財政部提供的共通性載具之一，可以用來儲存雲端發票。使用載具的好處包括：減少紙本發票、集中管理電子發票、方便查詢發票，以及可以進行歸戶與搭配領獎設定。簡單來說：把發票存在載具裡，就不用每次都拿一張紙本發票；但實際開立方式仍會依店家與消費情況而不同，並非每一種載具都適用於所有店家。也請注意，載具是用來儲存電子發票的工具，並不是付款工具。",
          en:
            "A \"carrier\" (載具) is a tool for storing electronic invoices — a carrier that's properly registered and set up can be used to store your e-invoices. Common carriers include a mobile barcode, EasyCard, iPASS, icash, and some credit or debit cards. Among these, the \"mobile barcode\" is one of the common carriers provided by the Ministry of Finance, used to store cloud invoices. Benefits of using a carrier include fewer paper invoices, centralized management of your e-invoices, easier invoice lookup, and the ability to register the carrier under your name and set up prize notifications. Put simply: storing your invoices in a carrier means you don't need to take a paper invoice every time — though actual issuance still depends on the store and the transaction, and not every carrier is accepted everywhere. Also note that a carrier is a tool for storing e-invoices, not a payment method.",
        },
        officialLinks: [
          { url: "https://www.einvoice.nat.gov.tw/", label: { "zh-TW": "電子發票官方平台", en: "Official E-Invoice Platform" } },
        ],
      },
    ],
  },
  {
    id: "southern-temples",
    name: { "zh-TW": "南部廟宇", en: "Southern Taiwan Temples" },
    icon: "Landmark",
    description: {
      "zh-TW": "台灣南部幾間具代表性的廟宇，認識民間信仰與地方文化的重要據點。",
      en: "A few landmark temples in southern Taiwan — good starting points for understanding local folk religion and culture.",
    },
    items: [
      {
        id: "donggang-donglong-temple",
        title: { "zh-TW": "東港東隆宮", en: "Donglong Temple, Donggang" },
        detail: {
          "zh-TW": "屏東東港最具代表性的廟宇之一，以三年一科的「東港迎王平安祭典」聞名。",
          en: "One of Donggang's most iconic temples, famous for the triennial \"Wang Yeh\" boat-burning festival.",
        },
        fullDetail: {
          "zh-TW":
            "東港東隆宮是屏東最具代表性的廟宇之一，也是東港地區重要的信仰中心。每三年舉辦一次著名的「東港迎王平安祭典」，其中包含遶境與王船等傳統文化活動。\n\n主要祭拜：溫府千歲（溫王爺）\n\n神明介紹：溫府千歲是王爺信仰中的重要神明，主要保佑地方平安、驅除災厄，也是東港迎王祭典的重要信仰核心。",
          en:
            "Donglong Temple is one of Pingtung's most iconic temples and a key spiritual center for the Donggang area. Every three years it hosts the famous \"Donggang Wang Yeh Boat Burning Festival,\" featuring temple processions and the ceremonial王船 (royal boat) tradition.\n\nMain deity: Lord Wen (溫府千歲)\n\nAbout the deity: Lord Wen is an important deity in Wang Yeh (Royal Lord) worship, believed to protect the local community and ward off disaster — he is central to the Donggang Wang Yeh festival's spiritual tradition.",
        },
      },
      {
        id: "checheng-fuan-temple",
        title: { "zh-TW": "車城福安宮", en: "Fu'an Temple, Checheng" },
        detail: {
          "zh-TW": "位於屏東車城，是台灣知名的土地公廟，也是許多前往墾丁的遊客會順道參觀的景點。",
          en: "Located in Checheng, Pingtung — one of Taiwan's best-known Earth God temples, and a popular stop for visitors heading to Kenting.",
        },
        fullDetail: {
          "zh-TW":
            "車城福安宮位於屏東車城，是台灣知名的土地公廟之一，也是許多前往墾丁旅遊的遊客會順道參觀的景點。\n\n主要祭拜：福德正神（土地公）\n\n神明介紹：福德正神又稱為土地公，是台灣民間信仰中常見的地方守護神，掌管土地、地方平安與人民生活，也象徵財富與福氣。",
          en:
            "Fu'an Temple is located in Checheng, Pingtung, and is one of Taiwan's best-known temples dedicated to the Earth God. It's also a popular stop for visitors on their way to Kenting.\n\nMain deity: Earth God (福德正神, also called Tudigong)\n\nAbout the deity: The Earth God is a widely worshipped local guardian deity in Taiwanese folk religion, overseeing land, local peace, and people's daily lives — also seen as a symbol of wealth and good fortune.",
        },
      },
      {
        id: "pingtung-cifeng-temple",
        title: { "zh-TW": "屏東慈鳳宮", en: "Cifeng Temple, Pingtung" },
        detail: {
          "zh-TW": "位於屏東市中心，是當地重要的信仰中心之一，廟宇歷史悠久。",
          en: "Located in the heart of Pingtung City, a long-standing and important center of local worship.",
        },
        fullDetail: {
          "zh-TW":
            "屏東慈鳳宮位於屏東市中心，是當地重要的信仰中心之一。廟宇歷史悠久，也是屏東市民進行祭拜與參與傳統宗教活動的重要場所。\n\n主要祭拜：媽祖（天上聖母）\n\n神明介紹：媽祖又稱為天上聖母，是台灣最重要的民間信仰神明之一。最初被視為海上守護神，保佑漁民與航海者平安，後來也成為守護人民的重要神明。",
          en:
            "Cifeng Temple sits in the center of Pingtung City and is one of the area's important centers of worship. With a long history, it's a key gathering place for local residents' prayers and traditional religious activities.\n\nMain deity: Mazu (媽祖, the Heavenly Empress)\n\nAbout the deity: Mazu, also known as the Heavenly Empress, is one of Taiwan's most important folk deities. Originally worshipped as a protector of fishermen and sailors at sea, she later became a broadly revered guardian of the people.",
        },
      },
      {
        id: "donggang-chaolong-temple",
        title: { "zh-TW": "東港朝隆宮", en: "Chaolong Temple, Donggang" },
        detail: {
          "zh-TW": "東港地區重要的媽祖廟之一，與當地漁業文化和海洋生活關係密切。",
          en: "One of Donggang's important Mazu temples, closely tied to the local fishing industry and maritime life.",
        },
        fullDetail: {
          "zh-TW":
            "東港朝隆宮是東港地區重要的媽祖廟之一，與當地的漁業文化和海洋生活有密切關係，是許多漁民祈求出海平安的重要信仰場所。\n\n主要祭拜：媽祖（天上聖母）\n\n神明介紹：媽祖被視為海上與人民的守護神，特別受到沿海地區與漁民的信仰。人們會祈求媽祖保佑航行安全、家庭平安與生活順利。",
          en:
            "Chaolong Temple is one of Donggang's important Mazu temples, closely connected to the local fishing industry and maritime way of life. It's a key place of worship where fishermen pray for safety before heading out to sea.\n\nMain deity: Mazu (媽祖, the Heavenly Empress)\n\nAbout the deity: Mazu is regarded as a guardian of both the sea and the people, especially revered in coastal communities and among fishermen, who pray to her for safe voyages, family wellbeing, and a smooth life.",
        },
      },
      {
        id: "pingtung-yuhuang-temple",
        title: { "zh-TW": "屏東玉皇宮", en: "Yuhuang Temple, Pingtung" },
        detail: {
          "zh-TW": "屏東市重要的道教信仰場所之一，許多信徒會前往祭拜天公。",
          en: "An important Taoist temple in Pingtung City, where many worshippers come to pray to the \"Heavenly Lord.\"",
        },
        fullDetail: {
          "zh-TW":
            "屏東玉皇宮是屏東市重要的道教信仰場所之一，許多信徒會前往祭拜天公，祈求家庭平安、生活順利。\n\n主要祭拜：玉皇大帝（天公）\n\n神明介紹：玉皇大帝俗稱「天公」，在台灣民間信仰中被視為掌管天界與眾神的重要神明，具有崇高的地位。",
          en:
            "Yuhuang Temple is an important Taoist site of worship in Pingtung City, where many worshippers come to pray to the \"Jade Emperor,\" seeking peace for their families and a smooth life.\n\nMain deity: The Jade Emperor (玉皇大帝, commonly called \"Tiangong\" / the Heavenly Lord)\n\nAbout the deity: The Jade Emperor, popularly known as Tiangong, is regarded in Taiwanese folk religion as the supreme ruler of the heavens and all deities, holding the highest standing.",
        },
      },
    ],
  },
];
