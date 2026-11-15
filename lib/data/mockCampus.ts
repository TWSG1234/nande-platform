import { CampusCategoryId, CampusSpot, Localized } from "@/lib/types";

export const campusCategoryLabel: Record<CampusCategoryId, Localized> = {
  culture: { "zh-TW": "校園文化 Q&A", en: "Campus Culture Q&A" },
  "school-units": { "zh-TW": "學校單位", en: "School Units" },
};

export const campusSpots: CampusSpot[] = [
  {
    id: "why-flag-raising",
    schoolTimes: [
      { school: "屏東縣屏榮高級中學", time: "7:45～8:00" },
      { school: "國立屏東高級工業職業學校", time: "7:50～8:00" },
      { school: "屏東縣立大同高中", time: "07:35～07:55" },
    ],
    name: { "zh-TW": "升旗", en: "Flag-Raising" },
    category: "culture",
    description: {
      "zh-TW": "早期受到軍事教育與公民教育影響，許多學校會透過升旗典禮培養學生的集體意識、尊重國家象徵及宣布校務。",
      en: "Rooted in earlier military and civic education traditions, many schools hold a flag-raising ceremony to build students' sense of collective identity, teach respect for national symbols, and make school-wide announcements.",
    },
    details: {
      "zh-TW":
        "早期受到軍事教育與公民教育影響，許多學校會透過升旗典禮培養學生的集體意識、尊重國家象徵及宣布校務。",
      en:
        "Rooted in earlier military and civic education traditions, many schools hold a flag-raising ceremony to build students' sense of collective identity, teach respect for national symbols, and make school-wide announcements.",
    },
  },
  {
    id: "why-nap-time",
    schoolTimes: [
      { school: "屏東縣屏榮高級中學", time: "12:00～13:05" },
      { school: "國立屏東高級工業職業學校", time: "12:00～13:00" },
      { school: "屏東縣立大同高中", time: "12:20～13:00" },
    ],
    name: { "zh-TW": "午休", en: "Midday Rest" },
    category: "culture",
    description: {
      "zh-TW": "台灣夏季炎熱，加上學生上課時間較長，因此逐漸形成午休制度，希望學生下午能保持精神，也有助於維持下午的學習效率。",
      en: "Because Taiwan's summers are hot and the school day runs long, a midday rest period developed over time to help students recharge and stay focused through afternoon classes.",
    },
    details: {
      "zh-TW":
        "台灣夏季炎熱，加上學生上課時間較長，因此逐漸形成午休制度，希望學生下午能保持精神，也有助於維持下午的學習效率。",
      en:
        "Because Taiwan's summers are hot and the school day runs long, a midday rest period developed over time to help students recharge and stay focused through afternoon classes.",
    },
  },
  {
    id: "why-students-clean",
    name: { "zh-TW": "學生打掃", en: "Student Cleaning Duty" },
    category: "culture",
    description: {
      "zh-TW": "台灣學校受到日本教育制度影響，認為學生共同維護校園環境，可以培養責任感、合作精神與愛惜公共空間的習慣，因此許多學校保留打掃制度。",
      en: "Influenced by Japan's education system, Taiwanese schools believe that students cleaning the campus together builds responsibility, teamwork, and respect for shared spaces — so many schools still keep this daily cleaning routine.",
    },
    details: {
      "zh-TW":
        "台灣學校受到日本教育制度影響，認為學生共同維護校園環境，可以培養責任感、合作精神與愛惜公共空間的習慣，因此許多學校保留打掃制度。",
      en:
        "Influenced by Japan's education system, Taiwanese schools believe that students cleaning the campus together builds responsibility, teamwork, and respect for shared spaces — so many schools still keep this daily cleaning routine.",
    },
  },
  {
    id: "why-school-uniforms",
    name: { "zh-TW": "制服", en: "School Uniforms" },
    category: "culture",
    description: {
      "zh-TW": "制服最初是為了方便辨識學生身分、管理校園秩序，也希望減少學生之間因穿著品牌或價格不同而產生的比較，營造較公平的學習環境，同時培養班級與學校的認同感。",
      en: "Uniforms originally made it easy to identify students and keep order on campus. They also reduce comparisons over clothing brands or prices, creating a more equal environment while building a sense of belonging to one's class and school.",
    },
    details: {
      "zh-TW":
        "制服最初是為了方便辨識學生身分、管理校園秩序，也希望減少學生之間因穿著品牌或價格不同而產生的比較，營造較公平的學習環境，同時培養班級與學校的認同感。",
      en:
        "Uniforms originally made it easy to identify students and keep order on campus. They also reduce comparisons over clothing brands or prices, creating a more equal environment while building a sense of belonging to one's class and school.",
    },
  },
  {
    id: "why-teachers-move",
    name: { "zh-TW": "老師到班級上課", en: "Teachers Rotate Classrooms" },
    category: "culture",
    description: {
      "zh-TW": "台灣高中職多採固定班級制度，學生大部分時間留在同一間教室，由老師到各班授課。這樣方便班級管理，也有助於培養班級凝聚力。",
      en: "Most Taiwanese high schools use a fixed-classroom system, where students stay in the same room most of the day and teachers rotate between classes — making classroom management easier and building a stronger sense of class unity.",
    },
    details: {
      "zh-TW":
        "台灣高中職多採固定班級制度，學生大部分時間留在同一間教室，由老師到各班授課。這樣方便班級管理，也有助於培養班級凝聚力。",
      en:
        "Most Taiwanese high schools use a fixed-classroom system, where students stay in the same room most of the day and teachers rotate between classes — making classroom management easier and building a stronger sense of class unity.",
    },
  },

  // ── 學校單位 School Units ─────────────────────────────────────────────
  {
    id: "unit-academic-affairs",
    name: { "zh-TW": "教務處", en: "Office of Academic Affairs" },
    category: "school-units",
    description: {
      "zh-TW": "學習、課程、成績",
      en: "Academics, courses, and grades",
    },
    mainResponsibility: {
      "zh-TW": "學習、課程、成績",
      en: "Academics, courses, and grades",
    },
    exchangeStudentMayEncounter: [
      { "zh-TW": "課程相關問題", en: "Course-related questions" },
      { "zh-TW": "選課、調課", en: "Course registration and schedule changes" },
      { "zh-TW": "成績、學習相關事項", en: "Grades and academic records" },
      { "zh-TW": "課表或上課安排", en: "Class schedules and arrangements" },
    ],
  },
  {
    id: "unit-student-affairs",
    name: { "zh-TW": "學務處", en: "Office of Student Affairs" },
    category: "school-units",
    description: {
      "zh-TW": "學生生活與校園活動",
      en: "Student life and campus activities",
    },
    mainResponsibility: {
      "zh-TW": "學生生活與校園活動",
      en: "Student life and campus activities",
    },
    exchangeStudentMayEncounter: [
      { "zh-TW": "校園生活問題", en: "Everyday campus-life questions" },
      { "zh-TW": "學生相關規定", en: "Student rules and regulations" },
      { "zh-TW": "校內活動", en: "Campus events" },
      { "zh-TW": "社團、學生事務", en: "Clubs and student affairs" },
    ],
  },
  {
    id: "unit-general-affairs",
    name: { "zh-TW": "總務處", en: "Office of General Affairs" },
    category: "school-units",
    description: {
      "zh-TW": "校園環境與行政事務",
      en: "Campus facilities and administrative affairs",
    },
    mainResponsibility: {
      "zh-TW": "校園環境與行政事務",
      en: "Campus facilities and administrative affairs",
    },
    exchangeStudentMayEncounter: [
      { "zh-TW": "校園設備問題", en: "Campus facility or equipment issues" },
      { "zh-TW": "教室、場地相關問題", en: "Classroom and venue matters" },
      { "zh-TW": "校園環境與物品", en: "Campus environment and supplies" },
      { "zh-TW": "失物相關問題", en: "Lost and found" },
    ],
  },
  {
    id: "unit-counseling",
    name: { "zh-TW": "輔導室", en: "Counseling Office" },
    category: "school-units",
    description: {
      "zh-TW": "學生適應與輔導",
      en: "Student adjustment and counseling",
    },
    mainResponsibility: {
      "zh-TW": "學生適應與輔導",
      en: "Student adjustment and counseling",
    },
    exchangeStudentMayEncounter: [
      { "zh-TW": "在學校遇到適應問題", en: "Trouble adjusting to school life" },
      { "zh-TW": "人際相處困擾", en: "Interpersonal difficulties" },
      { "zh-TW": "情緒或生活上的困難", en: "Emotional or personal challenges" },
      { "zh-TW": "需要找老師聊聊", en: "Wanting to talk to a counselor" },
    ],
  },
];
