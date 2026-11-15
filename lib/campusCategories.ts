/**
 * 校園座標大分類（純函式）。CampusSpot.category 存分類 id；前台沿用舊的 "school-units"（連字號）寫法來代表 id "school_units"。
 */
export interface CategoryInfo {
  id: string; // 資料庫 id（school_units 這種）
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  order: number;
  isPublished: boolean;
}

export const DEFAULT_CAMPUS_CATEGORIES: CategoryInfo[] = [
  { id: "culture", nameZh: "校園文化 Q&A", nameEn: "Campus Culture Q&A", descriptionZh: "", descriptionEn: "", order: 0, isPublished: true },
  { id: "school_units", nameZh: "學校單位", nameEn: "School Units", descriptionZh: "", descriptionEn: "", order: 1, isPublished: true },
];

export const toFrontCategoryId = (dbId: string) => (dbId === "school_units" ? "school-units" : dbId);
export const toDbCategoryId = (frontId: string) => (frontId === "school-units" ? "school_units" : frontId);
export const CATEGORY_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * 實際要用的分類清單：資料表有資料就用資料表；空的就用預設兩個。
 * 另外，如果有項目的分類 id 不在清單內（資料不一致），補一個「（未分類）」群組，確保任何項目都不會因此消失。
 */
export function resolveCategories(rows: Partial<CategoryInfo>[] | null | undefined, usedIds: string[] = []): CategoryInfo[] {
  const base: CategoryInfo[] = rows && rows.length
    ? rows.map((r, i) => ({ id: String(r.id), nameZh: String(r.nameZh ?? r.id), nameEn: String(r.nameEn ?? ""), descriptionZh: String(r.descriptionZh ?? ""), descriptionEn: String(r.descriptionEn ?? ""), order: Number.isFinite(Number(r.order)) ? Number(r.order) : i, isPublished: r.isPublished !== false }))
    : DEFAULT_CAMPUS_CATEGORIES.map((c) => ({ ...c }));
  const known = new Set(base.map((c) => c.id));
  for (const id of usedIds) {
    if (!known.has(id)) {
      known.add(id);
      base.push({ id, nameZh: "（未分類）", nameEn: "Uncategorized", descriptionZh: "", descriptionEn: "", order: 9999, isPublished: true });
    }
  }
  return base.sort((a, b) => a.order - b.order);
}

/** 表單送來的分類（前台或資料庫 id）→ 資料庫 id；必須是現有分類之一（資料表空／不存在時用預設兩個），否則回傳 null（拒絕，不悄悄改成別的分類）。 */
export async function resolveCampusCategoryId(prisma: any, v: unknown): Promise<string | null> {
  if (typeof v !== "string") return null;
  const id = toDbCategoryId(v.trim());
  if (!CATEGORY_ID_RE.test(id)) return null;
  let rows: { id: string }[] = [];
  try {
    rows = await prisma.campusCategory.findMany({ select: { id: true } });
  } catch {
    rows = [];
  }
  const ids = rows.length ? rows.map((r) => r.id) : DEFAULT_CAMPUS_CATEGORIES.map((c) => c.id);
  return ids.includes(id) ? id : null;
}
