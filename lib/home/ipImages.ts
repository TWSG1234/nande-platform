import { heroCharacters } from "@/lib/data/heroCharacters";
import type { IpCharId } from "./ipLayout";

/** 後台「網站外觀」的 IP角色 1／2／3 圖片欄位 ↔ 首頁三個固定位置（A＝布迪、B＝威洛、C＝帕菲）。 */
export const IP_IMAGE_FIELD: Record<IpCharId, "ipCharacter1Url" | "ipCharacter2Url" | "ipCharacter3Url"> = {
  characterA: "ipCharacter1Url",
  characterB: "ipCharacter2Url",
  characterC: "ipCharacter3Url",
};

export type HeroImage = { src: string; width: number; height: number; custom: boolean };

/** 只接受站內圖片網址（上傳的 /uploads/…、內建的 /images/…）。 */
export const isSafeImageUrl = (u: unknown): u is string => typeof u === "string" && /^\/(uploads|images)\/[^\s"'<>\\]+$/.test(u) && !u.includes("..");

/**
 * 首頁每個角色實際使用的圖片：後台上傳的（網站外觀 → IP角色 N）優先，沒有或網址不安全才用內建圖。
 * 上傳圖片的原始寬高未知（width/height 為 0），前台用 CSS 讓圖片依自己的原始比例顯示。
 */
export function resolveHeroImages(appearance: Partial<Record<"ipCharacter1Url" | "ipCharacter2Url" | "ipCharacter3Url", string | null>>): Record<IpCharId, HeroImage> {
  const out = {} as Record<IpCharId, HeroImage>;
  for (const id of Object.keys(IP_IMAGE_FIELD) as IpCharId[]) {
    const built = heroCharacters[id];
    const custom = appearance[IP_IMAGE_FIELD[id]];
    out[id] = isSafeImageUrl(custom) ? { src: custom, width: 0, height: 0, custom: true } : { src: built.src, width: built.width, height: built.height, custom: false };
  }
  return out;
}
