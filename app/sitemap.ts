import type { MetadataRoute } from "next";
import { campusSpots } from "@/lib/data/mockCampus";
import { lifeCategories } from "@/lib/data/mockLife";
import { chineseCategories, chineseLevels } from "@/lib/data/chineseLearning";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://taiwancompass.example.edu";
  const staticRoutes = ["", "/campus", "/life", "/chinese", "/calendar", "/ip-characters", "/about"];
  const campusRoutes = campusSpots.map((s) => `/campus/${s.id}`);
  const lifeRoutes = lifeCategories.flatMap((c) => c.items.map((i) => `/life/${i.id}`));
  const chineseCategoryRoutes = chineseCategories.map((c) => `/chinese/${c.id}`);
  const chineseLevelRoutes = chineseLevels.map((l) => `/chinese/${l.categoryId}/${l.level}`);

  const routes = [...staticRoutes, ...campusRoutes, ...lifeRoutes, ...chineseCategoryRoutes, ...chineseLevelRoutes];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
