import type { Metadata } from "next";
import CampusContent from "@/components/CampusContent";
import { getCampusCategories, getCampusSpots, getInfoBoxImages } from "@/lib/serverData";

export const metadata: Metadata = {
  title: "校園座標 Campus Guide",
  description: "行政單位、圖書館、宿舍、餐廳、超商、ATM、醫護室、停車場與校車資訊，一站掌握你的校園生活。",
};

// 後台編輯後，前台重新整理一定要看到最新內容，不要用 Next.js 的快取結果。
export const dynamic = "force-dynamic";

export default async function CampusPage() {
  const [spots, categories, decor] = await Promise.all([getCampusSpots(), getCampusCategories(), getInfoBoxImages("campus")]);
  return <CampusContent spots={spots} categories={categories} decor={decor} />;
}
