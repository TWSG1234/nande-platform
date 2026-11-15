# CLAUDE.md — 「南得遇見你」長期維護規範（資料保護優先）

這份規範適用於之後**所有**功能修改。網站的資料與程式碼是分開的：程式碼隨版本更新，資料永遠留在使用者電腦上的「固定資料資料夾」。
（本檔案可能被提交到版本控制，所以不寫任何個人電腦的絕對路徑；實際路徑只存在使用者自己的環境變數或家目錄設定檔。）

## 一、固定資料位置（本機模式）
- 固定資料資料夾內：`dev.db`（正式 SQLite 資料庫）、`uploads\`（上傳圖片）、`backups\`（資料庫備份）。
- 位置來源（優先順序）：環境變數 `NANDE_DATA_DIR` → 使用者家目錄的 `.nande-platform.json`。
- 唯一的設定核心：`lib/config/dataConfig.ts`；所有 tsx 工具的連線入口：`prisma/tools/dbClient.ts`；網站：`lib/prisma.ts`。**請保留這套架構**。
- 本機模式不使用、也不要改回依賴專案內的 `DATABASE_URL="file:./dev.db"`。`DATABASE_URL` 只在 `NANDE_DB_MODE=remote`（未來 PostgreSQL）使用，切換前必須先規劃資料遷移（見 `docs/PostgreSQL與雲端儲存遷移指南.md`）。

## 二、最高優先：不得破壞現有資料
1. 不得刪除、清空、重建或覆蓋固定資料夾中的 `dev.db`。
2. 下載新 ZIP、解壓縮到新資料夾、`npm install`、`npm run dev`、`npm run build`、`prisma generate` 都**不可**清除或重建資料。
3. 一般啟動、安裝、建置、更新流程**不得**自動執行 `db:seed`、資料匯入、資料重設、清空資料。
4. 不得把固定資料庫複製回專案內的 `prisma/dev.db`；不得在未告知下改讀另一份資料庫。
5. 不得刪除、覆蓋或重新命名既有上傳圖片。新圖片一律使用 UUID 檔名；管理員「刪除」圖片只是移到 `uploads\_trash\`（可找回），不真正刪檔。
6. `.nande-platform.json` 不得放進專案或 ZIP，更新時也不得覆蓋。
7. 不得為了讓程式啟動成功而建立空資料庫取代原本的資料庫。
8. 發現資料庫不存在／無法讀取／設定遺失／資料表不一致／圖片路徑失效時：**停止可能造成資料變更的操作**，先顯示清楚的錯誤原因與修復方案。

## 三、禁止與限制的指令
- 永遠不要執行：`prisma migrate reset`、`prisma db push --force-reset`、`--accept-data-loss`（`prismaCli` 包裝一律拒絕）。
- 不要直接執行 `npx prisma …`（會讀 `.env`，可能連到錯的資料庫），一律用 `npm run db:*` 包裝。
- 只能在「已備份、使用者明確要求」時手動執行，且必須加 `-- --confirm`：`db:seed`、`db:import-life*`、`db:reset-life-vocabulary`。
- 需要寫入或大量修改資料的工具：必須有人工確認步驟、先備份、先預覽、可重複執行、不覆蓋後台已改的內容、不重複新增（範例：`db:restore-life`）。
- `db:doctor`、`db:update` 的檢查部分、`db:verify-backup`、`check:project` 必須保持**唯讀**。

## 四、資料庫結構與資料修改
1. 修改 `prisma/schema.prisma` 前先用 `npm run db:doctor` 檢查現有資料庫結構。
2. 要新增／修改資料表或欄位：**先向使用者說明變更內容與影響**，再提出只新增、不丟資料的安全方案；經同意後才由使用者手動執行 `npm run db:push`（自動先備份）。
3. 一般網站更新只更新程式碼，不重新匯入原有資料。
4. 內容資料更新（關卡、單字、漫畫等）與程式碼更新分開處理。

## 五、圖片與上傳
1. 上傳、讀取、編輯、刪除一律走 `lib/storage`（固定資料夾 `uploads`），不得直接寫 `public/uploads`。
2. 維持 `/uploads/...` 網址相容（`next.config.js` 轉到 `/api/files`，限制在 uploads 內、僅圖片格式、擋路徑穿越與符號連結）。
3. 搬移／整理圖片前必須先備份並檢查資料庫內所有圖片路徑；禁止直接刪除原始圖片。
4. 內建預設圖片放 `prisma/assets/uploads`，只用「缺才複製、不覆蓋」的方式補到固定資料夾。

## 六、備份
1. 更新資料庫結構前先建立時間戳記備份（`db:update`、`db:push`、`db:restore-life --apply` 會自動備份）。
2. 備份不得覆蓋既有備份；不得自動刪除使用者既有備份（不要保留其他人刪備份的腳本）。
3. 資料庫備份與上傳圖片備份分開處理，並在管理文件說明。
4. 檢查備份：`npm run db:verify-backup`（存在、大小、可開啟、完整性、主要資料筆數）。

## 七、每次修改後的必要檢查（依序）
1. 固定資料設定程式仍存在且正常（`lib/config/dataConfig.ts`、`prisma/tools/dbClient.ts`、`lib/prisma.ts`、`lib/storage`、`next.config.js` 的 `/uploads` 轉接）。
2. `npm run check:project`：沒有誤放的 `dev.db`、`.nande-platform.json`、`public/uploads`，沒有繞過固定資料夾的程式。
3. `npm run db:doctor`：顯示固定資料庫路徑，資料筆數與修改前一致。
4. 一般啟動不會自動 seed／匯入／重設／清空（檢查 `package.json` 的 `dev`、`build`、`start`、`postinstall`）。
5. 圖片：既有 `/uploads/...` 仍能顯示；新上傳存進固定資料夾 `uploads`。
6. `npm run db:verify-backup`：備份存在且可讀。
7. 打包 ZIP 時不得包含：`prisma/dev.db*`、`.env`、`.nande-platform.json`、`public/uploads`、`prisma/migrations`、`prisma/backups`、`node_modules`、`.next`。
8. 回報時誠實列出「沒有實際驗證」的項目（沙箱通常無法下載 Prisma 引擎，`next build` 與真實資料庫讀寫要使用者在本機驗證）。

## 八、其他
- 不建立需要每次手動執行的一次性 `.bat`／`.ps1`。
- 網站配色：主色 `#84bed7`、輔色 `#2a6ea2`；桌面版與手機版版面各自獨立；只修改使用者要求的範圍。
