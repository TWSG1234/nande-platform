import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, getLevelsForCategory } from "@/lib/data/chineseLearning";
import { getChineseData } from "@/lib/serverData";
import ChineseCategoryContent from "@/components/ChineseCategoryContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { categoryId: string } }): Promise<Metadata> {
  const { categories } = await getChineseData();
  const category = getCategory(params.categoryId, categories);
  if (!category) return {};
  return {
    title: `${category.nameZh} ${category.nameEn}`,
    description: category.description["zh-TW"],
  };
}

export default async function ChineseCategoryPage({ params }: { params: { categoryId: string } }) {
  const { categories, levels } = await getChineseData();
  const category = getCategory(params.categoryId, categories);
  if (!category) notFound();
  const categoryLevels = getLevelsForCategory(params.categoryId, levels);
  return <ChineseCategoryContent category={category} levels={categoryLevels} />;
}
