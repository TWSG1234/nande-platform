import { notFound } from "next/navigation";
import { getChineseStageDetail } from "@/lib/serverData";
import ChineseStageFlowContent from "@/components/ChineseStageFlowContent";

export const dynamic = "force-dynamic";

// 同 app/chinese/life/[stageId]/page.tsx 的說明——track 固定是 "campus"。
export default async function ChineseCampusStagePage({ params }: { params: { stageId: string } }) {
  const stage = await getChineseStageDetail(params.stageId);
  if (!stage || stage.track !== "campus") notFound();

  return <ChineseStageFlowContent key={stage.id} track="campus" stage={stage} />;
}
