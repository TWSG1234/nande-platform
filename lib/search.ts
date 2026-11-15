import { campusSpots, campusCategoryLabel } from "@/lib/data/mockCampus";
import { lifeCategories } from "@/lib/data/mockLife";
import { SearchRecord } from "@/lib/types";

function keywordsOf(...parts: string[]) {
  return parts.join(" ").toLowerCase();
}

export const searchIndex: SearchRecord[] = [
  ...campusSpots.map<SearchRecord>((spot) => ({
    id: `campus-${spot.id}`,
    type: "campus",
    title: spot.name,
    snippet: spot.description,
    keywords: keywordsOf(
      spot.name["zh-TW"],
      spot.name.en,
      spot.description["zh-TW"],
      spot.description.en,
      campusCategoryLabel[spot.category]?.["zh-TW"] ?? "",
      campusCategoryLabel[spot.category]?.en ?? ""
    ),
    href: `/campus/${spot.id}`,
  })),
  ...lifeCategories.flatMap<SearchRecord>((cat) =>
    cat.items.map((item) => ({
      id: `life-${cat.id}-${item.id}`,
      type: "life",
      title: item.title,
      snippet: item.detail,
      keywords: keywordsOf(
        item.title["zh-TW"],
        item.title.en,
        item.detail["zh-TW"],
        item.detail.en,
        cat.name["zh-TW"],
        cat.name.en
      ),
      href: `/life/${item.id}`,
    }))
  ),
];

export function searchContent(query: string, limit = 8): SearchRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return searchIndex.filter((r) => r.keywords.includes(q)).slice(0, limit);
}
