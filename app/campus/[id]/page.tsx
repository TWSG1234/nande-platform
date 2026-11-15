import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampusCategories, getCampusSpots } from "@/lib/serverData";
import CampusDetailContent from "@/components/CampusDetailContent";

// 內容現在來自資料庫，管理員隨時可能新增/修改，所以不用 generateStaticParams
// 預先產生固定頁面，改成每次都是動態、即時查詢。
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const spots = await getCampusSpots();
  const spot = spots.find((s) => s.id === params.id);
  if (!spot) return {};
  return {
    title: `${spot.name["zh-TW"]} ${spot.name.en}`,
    description: spot.description["zh-TW"],
  };
}

export default async function CampusSpotPage({ params }: { params: { id: string } }) {
  const spots = await getCampusSpots();
  const spot = spots.find((s) => s.id === params.id);
  if (!spot) notFound();
  const categories = await getCampusCategories();
  return <CampusDetailContent spot={spot} categoryName={categories.find((c) => c.id === spot.category)?.name} />;
}
