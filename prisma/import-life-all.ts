/** npm run db:import-life -- --confirm ：依序執行生活區漫畫與單字匯入（兩者都會覆蓋後台改過的內容，必須明確確認）。 */
import { spawnSync } from "child_process";
import path from "path";
import { requireConfirm } from "./tools/dbClient";

requireConfirm("db:import-life", "會用內建資料覆蓋生活 1～8 關的名稱、單字與漫畫（含你在後台改過的）。");
for (const f of ["import-life-comics.ts", "import-life-vocabulary.ts"]) {
  const r = spawnSync(process.execPath, [require.resolve("tsx/cli", { paths: [process.cwd()] }), path.join(__dirname, f), "--confirm"], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
