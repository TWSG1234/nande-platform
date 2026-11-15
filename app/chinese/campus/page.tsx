import type { Metadata } from "next";
import ChineseStageListContent from "@/components/ChineseStageListContent";
import { getChineseStages } from "@/lib/serverData";

export const metadata: Metadata = {
  title: "校園中文 Campus Chinese｜中文學習",
  description: "校園生活中會用到的中文，五個關卡循序漸進學習。",
};

export const dynamic = "force-dynamic";

export default async function ChineseCampusPage() {
  const stages = await getChineseStages("campus");
  return <ChineseStageListContent track="campus" stages={stages} />;
}
