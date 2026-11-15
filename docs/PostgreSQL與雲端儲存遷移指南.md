# 未來切換 PostgreSQL 與雲端儲存的準備與步驟

> 目前狀態：**本機 SQLite + 固定資料夾**。本文件只是「未來」的準備與步驟，**現在不要執行**任何切換或資料遷移。

## 一、已經做好的擴充準備

| 項目 | 現況 |
|---|---|
| 資料位置集中管理 | 唯一入口 `lib/config/dataConfig.ts`；網站（`lib/prisma.ts`）、Prisma CLI 包裝、備份、診斷、匯入全部共用，沒有任何功能自己寫死路徑 |
| 本機／正式分開設定 | `NANDE_DB_MODE`：`local`（預設，固定資料夾裡的 SQLite）／`remote`（使用 `DATABASE_URL`，給 PostgreSQL） |
| 上傳檔案不綁電腦資料夾 | 網站只呼叫 `lib/storage`；`STORAGE_DRIVER=local`（固定資料夾）／`cloudinary`（Cloudinary 雲端，已實作，見管理員手冊第三十章；`s3` 尚未實作，選了會明確報錯，不會偷偷存本機） |
| 圖片網址穩定 | 資料庫只存 `/uploads/<子資料夾>/<檔名>`；搬到雲端時不必改資料庫內容（在儲存層轉址或改 CDN 網址即可） |

## 二、切換 PostgreSQL 時需要調整的地方（盤點結果）

### 1. `prisma/schema.prisma`
- `datasource db` 的 `provider = "sqlite"` 必須改成 `"postgresql"`（Prisma 的 provider 是寫死在 schema 裡的，無法用環境變數切換）。
- 其餘 model 為了相容 SQLite 而採用：**String 存 JSON**（`lib/jsonFields.ts`）、**String 代替 enum**。這些在 PostgreSQL 都能原樣運作，**不需要改**；之後想用原生 `Json`／`enum` 可再另行重構，非必要。
- `@default(cuid())`、`@updatedAt`、`@default(now())`、`onDelete: Cascade`：PostgreSQL 皆支援。
- 沒有使用 `@db.*` 型別屬性、沒有 SQLite 專屬型別。

### 2. 原生 SQL（SQLite 專用，切換後必須改寫或停用）
| 位置 | SQLite 專用寫法 | PostgreSQL 對應 |
|---|---|---|
| `prisma/tools/doctorCore.ts`、`doctor.ts`、`update.ts` | `sqlite_master`、`PRAGMA table_info` | `information_schema.tables / columns` |
| `prisma/tools/restoreLife.ts` | `sqlite_master`、`PRAGMA table_info` | 同上 |
| `prisma/tools/backupCore.ts`（`db:backup`） | `VACUUM INTO`、檔案備份 | `pg_dump` 或供應商的快照功能 |
| `prisma/tools/dbClient.ts`、`dataConfig.ts` | `file:` 連線字串、固定資料夾 | `NANDE_DB_MODE=remote` + `DATABASE_URL` |
網站程式本身（`app/`、`lib/`）**沒有**使用原生 SQL。

### 3. 交易與查詢行為
- 唯一的交易是 `app/api/admin/assistant/route.ts` 的 `prisma.$transaction([...])`（陣列形式），PostgreSQL 相容。
- **大小寫**：SQLite 的 `LIKE`／字串比對對英文不分大小寫，PostgreSQL 分大小寫。目前程式沒有使用 `contains`／`mode: "insensitive"` 搜尋；之後若新增搜尋，PostgreSQL 要加 `mode: "insensitive"`。
- **排序**：中文字串排序規則（collation）兩邊不同；目前排序都用 `order` 數字欄位與日期，不受影響。
- **並行寫入**：SQLite 同時只允許一個寫入；PostgreSQL 沒有此限制，不需要調整。
- **日期**：SQLite 以整數／文字儲存，PostgreSQL 是 `timestamp`；遷移資料時要確認時區（建議一律 UTC）。

### 4. 工具腳本
`db:seed`、`db:import-life*`、`db:reset-life-vocabulary` 透過 Prisma Client 運作，provider 改變後可用，但目前的 `prisma/tools/*` 診斷／備份是 SQLite 專用（見上表）。

## 三、未來切換步驟（建議在新資料夾、用「複製出來的資料」演練，不要動正式資料）

1. **備份**：`npm run db:backup`，並複製整個固定資料資料夾（含 `uploads/`）。
2. **建立 PostgreSQL**（Supabase／Neon／Vercel Postgres…），取得連線字串，先在測試用資料庫演練。
3. **修改 schema**：`provider = "postgresql"`；`NANDE_DB_MODE=remote`、`DATABASE_URL=postgresql://…`。
4. **建立資料表**：本專案目前沒有 migration 歷史（用 `db push`）。對**空的** PostgreSQL 執行 `npx prisma migrate dev --name init` 建立基準 migration（此時 `DATABASE_URL` 指向 PostgreSQL）；之後正式環境用 `prisma migrate deploy`。
5. **遷移既有資料**（SQLite → PostgreSQL）：任選
   - `pgloader`（支援 SQLite 來源）；或
   - 寫一次性的 Node 腳本：用 Prisma 以舊 SQLite 讀取每張表（連同 id、createdAt），再寫入 PostgreSQL。注意先寫父表再寫子表（外鍵順序：Stage → Page → Word/Question 等）。
   遷移後逐表比對筆數與抽樣內容。
6. **搬移上傳圖片**：把 `<固定資料夾>\uploads\` 整個上傳到雲端物件儲存（保持相同的相對路徑，例如 `content/xxxx.png`）。
7. **實作雲端儲存驅動**：在 `lib/storage` 新增 S3／R2 驅動（`put / remove / read`），設定 `STORAGE_DRIVER=s3` 與其金鑰；`/uploads/*` 改由儲存層轉址到雲端或 CDN（資料庫內的 `/uploads/...` 網址不必改）。
8. **改寫 SQLite 專用工具**（第二節表格）。
9. **驗證**：校園區、生活區、公告、IP 角色、投稿與圖片逐項檢查，確認後才切換正式流量；舊 SQLite 與舊 uploads 保留作為復原來源。

## 四、不要做的事
- 不要在沒有備份下對正式資料庫執行 `db push --accept-data-loss`、`migrate reset`。
- 不要把資料庫連線字串、金鑰寫進程式碼或提交到 GitHub；只放環境變數（`.env` 不進版本控制）。

## 五、Vercel 部署（本機 SQLite、正式環境 Neon PostgreSQL）

### 1. 兩份 schema 與自動選擇
- `prisma/schema.prisma`：SQLite，本機開發與所有維運工具使用（**不要改它的 provider**）。
- `prisma/schema.postgres.prisma`：PostgreSQL，Vercel 使用。model 必須與上一份**逐字一致**，只有 generator／datasource 不同（含 `binaryTargets = ["native", "rhel-openssl-3.0.x"]`，Vercel 的 Linux 需要）。
- `scripts/prisma-generate.js`（`build`、`postinstall`、`dev`、`db:generate` 都走它）：Vercel（`VERCEL=1`）→ PostgreSQL；本機 → SQLite。Vercel 上若缺少 PostgreSQL schema，build 會直接失敗，不會退回 SQLite。
- 修改資料表／欄位時，兩份 schema 要一起改。`npm run test:schema`、`npm run check:project` 會檢查是否一致。
- 本機想暫時產生 PostgreSQL Client 時才設 `PRISMA_SCHEMA_TARGET=postgres`；用完請不帶它重新執行 `npm run db:generate` 還原。

### 2. Vercel 環境變數（Production 與 Preview 分開設定）
| 變數 | Production | Preview |
|---|---|---|
| `NANDE_DB_MODE` | `remote` | `remote` |
| `NANDE_DB_TARGET` | `production` | `preview` |
| `NANDE_PROD_DB_HOST` | 正式資料庫主機名稱 | 同左（用來確認沒連到正式） |
| `DATABASE_URL` | 正式 Neon（pooled，加 `?sslmode=require&pgbouncer=true&connect_timeout=15`） | **獨立 Neon Branch** 的 pooled 連線字串 |
| `DIRECT_URL` | 不設定 | 不設定 |
| `STORAGE_DRIVER` + `CLOUDINARY_*` | `cloudinary` + 金鑰 | 同左（建議另一個 `CLOUDINARY_FOLDER`） |
| `NEXTAUTH_SECRET`、`NEXTAUTH_URL`、`GOOGLE_*` | 依原設定 | 依原設定（Preview 的 `NEXTAUTH_URL` 用該部署網址） |

這些變數在 **Build 階段也要存在**（網站程式載入時就會解析資料庫設定）。

### 3. Preview 不會誤寫正式資料庫的防護
在 Vercel 上（`VERCEL` 有值），網站與 build 啟動時會檢查，不符合就拒絕（錯誤訊息不含連線字串與密碼）：
- 必須宣告 `NANDE_DB_TARGET`（`production` 或 `preview`），且與 `VERCEL_ENV` 對得上；無法判斷的環境一律當 Preview。
- Preview 必須設定 `NANDE_PROD_DB_HOST`，且 `DATABASE_URL`（以及若有設的 `DIRECT_URL`）的主機不能等於它（pooler 與直連視為同一個資料庫）。
- Production 若有設 `NANDE_PROD_DB_HOST`，`DATABASE_URL` 主機必須與它相同（防止貼錯）。
- 本機行為不變。建議另外在 Vercel 把「正式資料庫」的變數只勾選 Production 環境。

### 4. 遠端維運工具阻擋
`NANDE_DB_MODE=remote` 時，備份、診斷、匯入、seed、restore、reset、calendar:images、db push／migrate／studio 等工具一律拒絕（沒有連線、不改資料）。`prismaCli` 另外拒絕 `--schema` 與連線字串參數。唯讀的啟動檢查不受影響。

### 5. 第一次部署前後要確認（無法在本機驗證的項目）
- Vercel build 日誌出現 `[prisma-generate] 使用 prisma/schema.postgres.prisma（postgresql）｜Vercel`。
- 查詢引擎 `rhel-openssl-3.0.x` 正常載入（首頁與登入後台可開啟）。
- 登入後台、讀取校園／生活／中文學習頁面、圖片經 Cloudinary 顯示。

### 6. 上傳大小限制（Vercel 單次請求本文約 4.5MB）
目前上傳路由與限制：學生投稿 `/api/uploads`（10MB）、後台圖片 `/api/admin/upload`（10MB）、首頁裝飾圖、正確動畫（MP4 8MB／GIF 5MB／SVG 512KB）。超過約 4.5MB 的檔案在 Vercel 上會在到達程式前被擋下（HTTP 413），網站原有限制與儲存方式不變。建議的解法（尚未實作，需另行評估）見交付說明：前端先壓縮圖片；影片與大檔改為瀏覽器直傳 Cloudinary（伺服器簽名）。
