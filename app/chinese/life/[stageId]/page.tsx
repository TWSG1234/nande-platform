import { notFound } from "next/navigation";
import { getChineseStageDetail } from "@/lib/serverData";
import ChineseStageFlowContent from "@/components/ChineseStageFlowContent";

export const dynamic = "force-dynamic";

// track 固定是 "life"——這個路由本來是 app/chinese/[track]/[stageId]，但
// [track] 只會是 "life" 或 "campus" 兩種固定值，跟舊版中文學習教材路由
// app/chinese/[categoryId] 同一層放了兩個「名字不一樣的動態資料夾」，
// Next.js 不允許這樣（要求同一層的動態資料夾名稱要一致），所以拆成
// app/chinese/life/[stageId] 和 app/chinese/campus/[stageId] 兩個各自獨立
// 的固定路徑，不再需要 [track] 這個動態層。網址本身完全沒變
// （/chinese/life/xxx、/chinese/campus/xxx），前面所有連到這裡的
// Link/router.push 都不用改。
export default async function ChineseLifeStagePage({ params }: { params: { stageId: string } }) {
  const stage = await getChineseStageDetail(params.stageId);
  if (!stage || stage.track !== "life") notFound();

  return <ChineseStageFlowContent key={stage.id} track="life" stage={stage} />;
}
