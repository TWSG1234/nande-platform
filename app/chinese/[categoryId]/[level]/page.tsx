import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, getLevel } from "@/lib/data/chineseLearning";
import { getChineseData } from "@/lib/serverData";
import ChineseLevelContent from "@/components/ChineseLevelContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { categoryId: string; level: string };
}): Promise<Metadata> {
  const levelNum = Number(params.level);
  const { categories, levels } = await getChineseData();
  const category = getCategory(params.categoryId, categories);
  const level = getLevel(params.categoryId, levelNum, levels);
  if (!category || !level) return {};
  return {
    title: `${level.title["zh-TW"]} ${level.title.en}`,
    description: `${category.nameZh} ${category.nameEn} · Level ${levelNum}`,
  };
}

export default async function ChineseLevelPage({ params }: { params: { categoryId: string; level: string } }) {
  const levelNum = Number(params.level);
  const { categories, levels } = await getChineseData();
  const category = getCategory(params.categoryId, categories);
  const level = !Number.isNaN(levelNum) ? getLevel(params.categoryId, levelNum, levels) : undefined;

  if (!category || !level) notFound();

  return <ChineseLevelContent category={category} level={level} categories={categories} levels={levels} />;
}
