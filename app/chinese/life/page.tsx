import type { Metadata } from "next";
import ChineseStageListContent from "@/components/ChineseStageListContent";
import { getChineseStages } from "@/lib/serverData";

export const metadata: Metadata = {
  title: "生活中文 Life Chinese｜中文學習",
  description: "日常生活中會用到的中文，五個關卡循序漸進學習。",
};

export const dynamic = "force-dynamic";

export default async function ChineseLifePage() {
  const stages = await getChineseStages("life");
  return <ChineseStageListContent track="life" stages={stages} />;
}
