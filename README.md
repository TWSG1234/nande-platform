# 異鄉座標 — 國際交換生來台生活平台

A life-in-Taiwan guide for international exchange students: Campus Guide, Life Guide, a
level-based Chinese Learning area, and a Taiwan Calendar driven by official government data —
searchable from the homepage, fully bilingual (繁體中文 / English), and usable on phone, tablet,
and desktop.

Built with **Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Framer Motion**,
now with a **Prisma + SQLite/Postgres backend and an `/admin` dashboard** (see "Backend" below).
The public-facing pages listed in "Project structure" still read from `lib/data/*.ts` for now —
Phase 2 will migrate them to read from the database one page at a time.

---

## Getting started (frontend only — same as before)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires internet access on first run —
`next/font/google` fetches Manrope / Noto Sans TC / IBM Plex Mono at build time.

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
```

## Backend & admin dashboard (Phase 1)

```bash
cp .env.example .env
# 編輯 .env：至少填 ADMIN_EMAIL / ADMIN_PASSWORD / NEXTAUTH_SECRET
# （NEXTAUTH_SECRET 可以用： openssl rand -base64 32 產生）

npx prisma migrate dev --name init   # 建立 SQLite 資料庫與資料表
npm run db:seed                       # 把現有 lib/data/*.ts 的內容匯入資料庫，並建立第一個管理員帳號
npm run dev
```

前往 [http://localhost:3000/admin/login](http://localhost:3000/admin/login)，用 `.env` 裡設定的
`ADMIN_EMAIL` / `ADMIN_PASSWORD` 登入。

其他常用指令：

```bash
npm run db:studio    # 開啟 Prisma Studio，直接用表格介面檢視/編輯資料庫
npx prisma migrate dev --name <描述>   # schema.prisma 改動後，建立新的 migration
```

**目前狀態**：資料庫 schema、管理員登入/登出、`/admin` 完整 CMS（公告／校園座標／生活座標／中文學習／
台灣行事曆／IP角色／學生投稿審核／網站設定，皆含新增、編輯、刪除、發布/隱藏、圖片上傳）、學生公開投稿頁
`/upload` 都已經完成，詳細操作步驟見 `docs/異鄉座標管理員操作說明.md`。**公開網站頁面（首頁、校園座標、
生活座標、中文學習、台灣行事曆、IP角色圖鑑）現在都會優先讀取資料庫**（見 `lib/serverData.ts`），資料庫
是空的或連線失敗時才會退回讀 `lib/data/*.ts` 的內容，確保網站不會直接開天窗。首頁的 Hero 3 隻角色仍然
維持原本寫死在 `lib/data/heroCharacters.ts` 的方式，不透過資料庫（原因見對話紀錄：避免破壞已調校好的版面）。

**正式上線時**：把 `prisma/schema.prisma` 的 `datasource` 從 `sqlite` 改成
`postgresql`，`DATABASE_URL` 換成 Vercel Postgres / Supabase 的連線字串，其餘程式碼不需要改動。
學生投稿圖片預設存在網站本機的 固定資料夾的 `uploads/`（見 docs 二之一）；設定好 `GOOGLE_CLIENT_EMAIL` /
`GOOGLE_PRIVATE_KEY` / `GOOGLE_DRIVE_FOLDER_ID` 三個環境變數後，管理員「通過」投稿時會自動改存進
Google Drive。


## Project structure

```
app/
  page.tsx                        首頁 → components/HomeContent.tsx
  campus/page.tsx                  校園座標 listing → components/CampusContent.tsx
  campus/[id]/page.tsx             校園座標 detail  → components/CampusDetailContent.tsx
  life/page.tsx                     生活座標 listing → components/LifeContent.tsx (same
                                     card format as Campus Guide)
  life/[id]/page.tsx                生活座標 detail  → components/LifeDetailContent.tsx
  chinese/page.tsx                  中文學習 home (4 categories) → components/ChineseHomeContent.tsx
  chinese/[categoryId]/page.tsx     Level list ("game map") → components/ChineseCategoryContent.tsx
  chinese/[categoryId]/[level]/     Single lesson → components/ChineseLevelContent.tsx
  calendar/page.tsx                 台灣行事曆 → components/CalendarContent.tsx
  ip-characters/page.tsx            IP角色介紹 — nav entry + route only; content pending
  about/page.tsx                     關於我們 → components/AboutContent.tsx
  layout.tsx, globals.css, loading.tsx, not-found.tsx, sitemap.ts, robots.ts
components/                     Reusable UI + the *Content.tsx page bodies above
  chinese/                        Drink illustration, level path, vocab/sentence panels
context/                        LanguageContext (client-side i18n state, zh-TW/en only)
lib/
  types.ts                        Shared TypeScript types — every user-facing string is
                                   `Localized` ({ "zh-TW": string; en: string })
  i18n/
    dictionary.ts                   Static UI string dictionary (zh-TW + en, key-for-key identical)
    pick.ts                          pick(field, lang) — resolves a Localized field to the active language
  search.ts                       Homepage search index, built from campus + life data
  announcementGenerator.ts        Derives the homepage announcement from calendar data — see below
  data/
    mockCampus.ts, mockLife.ts      Campus Guide / Life Guide content (5 entries each)
    mockCalendar.ts                 Official 2026 Taiwan holidays + the 9/21 memorial day
    drillNotice.ts                  Verified 2026 civil-defense drill dates (Jul/Aug reminder)
    fallbackAnnouncements.ts        Rotating homepage messages shown when nothing else applies
    chineseLearning.ts              4 categories × levels × vocabulary/sentences/drink config
    heroCharacters.ts                The two homepage mascot images
public/                         Manifest, icons, favicon, brand images
```

Every page under `app/` is a thin server component (keeps `metadata`/SEO); the actual bilingual
content and interactivity lives in the matching `components/*Content.tsx` client component.

## Homepage announcement board

The announcement card is **fully generated from calendar data** — nothing is hand-written per
occasion. `lib/announcementGenerator.ts` checks, in priority order, against the real current date:

1. Is today itself a holiday or the 9/21 memorial day? → say so plainly.
2. Is a holiday coming up within the next 3 days? → "OO即將到來" reminder (computed as
   `holiday.date − today`, not hardcoded).
3. Is it July or August? → drill-season reminder, using the verified dates in `drillNotice.ts`.
4. Is the 9/21 memorial day coming up within 3 days? → a "not a holiday" reminder.
5. Otherwise → rotate through `fallbackAnnouncements.ts` (site-tour tips, never fabricated events).

## Taiwan Calendar

`lib/data/mockCalendar.ts` contains **only** fixed-date national holidays (plus their 補假
days-in-lieu) and the 9/21 National Disaster Prevention Day memorial — sourced from 行政院人事行政
總處's official 115年（2026年）辦公日曆表 and 內政部消防署; see the citation comment at the top of
the file. School-specific items with no government-fixed date (exam weeks, semester start,
orientation, etc.) are intentionally not included.

- Holiday names render directly in each day cell (color-coded: solid coral for a paid day off,
  muted gray for a memorial-only day) and are clickable — opening `components/HolidayModal.tsx`
  with the full date, holiday/memorial status, and a short description.
- There is no calendar download/export feature.

## Chinese Learning area

Four categories (語言適應/校園適應/人際適應/文化交流) → a level list styled like a game map → a
single-lesson page with a Vocabulary panel, a reusable SVG bubble-tea illustration
(`components/chinese/DrinkIllustration.tsx`, built from stackable Cup/Liquid/Pearls/Ice/CreamFoam/
Straw parts so the same drink stays visually consistent across levels), an Example Sentences panel,
and Prev/Next level navigation. Pronunciation buttons use the browser's native `SpeechSynthesis`
API — no audio files, no backend.

## Design system

- **Palette** — `transit` (MRT-signage teal, primary), `lantern` (night-market coral, accent),
  `sunny` (lantern-light yellow, secondary), `ink`/`canvas` (text & surface neutrals). Defined in
  `tailwind.config.ts`.
- **Type** — Manrope (display), Noto Sans TC (body — covers both Latin and Traditional Chinese),
  IBM Plex Mono (dates/data).
- Dark mode via `next-themes` (`class` strategy), respecting `prefers-color-scheme` by default.
- **Homepage mascots** — two characters (`lib/data/heroCharacters.ts`) always shown together in
  the Hero, each with a floating idle animation and a click/tap bounce.

## Search

`lib/search.ts` builds a flat, pre-lowercased (both languages) index from every campus spot and
life-guide item at import time; `components/HomeSearch.tsx` filters it client-side as you type and
links straight to `/campus/[id]` or `/life/[id]`. No backend or search service required.

## What's still placeholder / needs your input

- `lib/data/*` content (campus/life Q&As, team bios, contact email) is illustrative — replace with
  your organization's real details before publishing.
- `/ip-characters` has a nav entry and route but no content yet, by design — add it when ready.
- If a future year's official 辦公日曆表 is published, update `mockCalendar.ts` (and
  `drillNotice.ts` once next year's drill dates are confirmed) rather than guessing ahead of time.

## Notes

- This project was written but not compiled in this environment (no network access here to fetch
  npm packages or Google Fonts) — run `npm install && npm run build` locally as your first
  verification step.
