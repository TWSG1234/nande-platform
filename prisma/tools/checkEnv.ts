/**
 * npm run check:env — 唯讀：檢查管理員登入需要的 .env 設定（NEXTAUTH_SECRET／NEXTAUTH_URL）。
 * 絕不印出任何變數的值，只顯示有沒有、長度與格式問題。
 */
import { analyzeEnv } from "./envCore";
const { issues } = analyzeEnv(process.cwd());
const icon = { error: "❌", warn: "⚠", info: "ℹ" } as const;
for (const i of issues) console.log(icon[i.level] + " " + i.message);
const bad = issues.some((i) => i.level === "error");
console.log(bad ? "\n→ 修正上面的 ❌ 後，必須「完全關閉並重新啟動」npm run dev（Next.js 只在啟動時讀 .env）。" : "\n✅ .env 的登入設定看起來正確。若登入仍失敗，請完全重啟 npm run dev。");
process.exit(bad ? 1 : 0);
