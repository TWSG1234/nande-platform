/** npm run check:project — 唯讀：檢查程式資料夾有沒有誤放的資料庫、設定檔、直接寫 public/uploads 或預設 PrismaClient 的程式。 */
import { guardProject } from "./guardCore";
const findings = guardProject(process.cwd());
if (!findings.length) console.log("✅ 專案資料夾檢查通過（沒有誤放的資料庫／設定檔，沒有繞過固定資料夾的程式）。");
for (const f of findings) console.log((f.level === "error" ? "❌ " : "⚠ ") + f.message);
process.exit(findings.some((f) => f.level === "error") ? 1 : 0);
