import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLifeCategories } from "@/lib/serverData";
import LifeDetailContent from "@/components/LifeDetailContent";
import { LifeCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

function findItem(categories: LifeCategory[], id: string) {
  for (const category of categories) {
    const item = category.items.find((i) => i.id === id);
    if (item) return { item, category };
  }
  return null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const categories = await getLifeCategories();
  const found = findItem(categories, params.id);
  if (!found) return {};
  return {
    title: `${found.item.title["zh-TW"]} ${found.item.title.en}`,
    description: found.item.detail["zh-TW"],
  };
}

export default async function LifeItemPage({ params }: { params: { id: string } }) {
  const categories = await getLifeCategories();
  const found = findItem(categories, params.id);
  if (!found) notFound();
  return <LifeDetailContent item={found.item} category={found.category} />;
}
