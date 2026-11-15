/** 啟動前的唯讀檢查（npm run dev / start 會先跑）：固定資料位置設定錯誤就立刻明確報錯。不寫入任何東西。 */
import { describeConfig, loadConfigOrExit } from "./dbClient";
const cfg = loadConfigOrExit({}, { allowRemote: true }); // 唯讀檢查：遠端模式也允許
for (const w of cfg.warnings) console.warn("⚠ " + w);
console.log("📁 " + describeConfig(cfg).slice(0, 2).join("  |  "));

// 管理員登入需要 NEXTAUTH_SECRET：啟動前就提醒（只提醒、不中斷、不顯示任何值）。
import { analyzeEnv } from "./envCore";
const env = analyzeEnv(process.cwd(), ["NEXTAUTH_SECRET"]).issues.filter((i) => i.level !== "info");
for (const i of env) console.warn((i.level === "error" ? "⚠ [管理員登入] " : "ℹ [管理員登入] ") + i.message + "（詳細：npm run check:env）");
