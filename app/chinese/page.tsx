import type { Metadata } from "next";
import ChineseHomeContent from "@/components/ChineseHomeContent";

export const metadata: Metadata = {
  title: "中文學習 Learn Chinese",
  description: "選擇「生活」或「校園」分區，開始學習生活中實用的中文。",
};

export default function ChinesePage() {
  return <ChineseHomeContent />;
}
