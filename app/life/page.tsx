import type { Metadata } from "next";
import LifeContent from "@/components/LifeContent";
import { getInfoBoxImages, getLifeCategories } from "@/lib/serverData";

export const metadata: Metadata = {
  title: "生活座標 Life Guide",
  description: "交通、醫療、銀行門號、租屋、超市夜市與常見生活問題，交換生的台灣生活指南。",
};

export const dynamic = "force-dynamic";

export default async function LifePage() {
  const [categories, decor] = await Promise.all([getLifeCategories(), getInfoBoxImages("life")]);
  return <LifeContent categories={categories} decor={decor} />;
}
