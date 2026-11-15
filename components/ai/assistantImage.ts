import { heroCharacters } from "@/lib/data/heroCharacters";
import type { AssistantSettings } from "@/lib/ai/types";
import type { AvatarState } from "@/lib/ai/avatarState";

/**
 * 助理角色圖：預設直接沿用首頁威洛（首頁角色 2 / characterB）的同一份素材，不複製、不裁切。
 * 後台若另外指定圖片（settings.imageUrl），只影響助理，不影響首頁、IP 身分證或其他素材。
 */
export function resolveAssistantImage(settings: Pick<AssistantSettings, "imageUrl">): {
  src: string;
  width?: number;
  height?: number;
} {
  if (settings.imageUrl) return { src: settings.imageUrl };
  const { src, width, height } = heroCharacters.characterB;
  return { src, width, height };
}

/** 內建的動作圖（隨程式提供，和待機圖同尺寸比例）。思考中目前沒有內建圖。 */
export const BUNDLED_STATE_IMAGES: Partial<Record<Exclude<AvatarState, "idle" | "custom">, string>> = {
  life_info: "/images/brand/willo-life-info.png",
  unresolved: "/images/brand/willo-unresolved.png",
};

type StateImageSettings = Pick<
  AssistantSettings,
  "imageUrl" | "thinkingImageUrl" | "unresolvedImageUrl" | "lifeInfoImageUrl"
>;

export type StateImageSource = "custom" | "bundled" | "idle";

/**
 * 某個狀態該顯示哪張圖。順序：後台上傳 → 內建動作圖 → 待機圖（威洛原圖）。
 * 待機（idle）永遠是待機圖。永遠回傳可用的圖片網址，不會是空的。
 */
export function resolveStateImage(
  settings: StateImageSettings,
  state: AvatarState,
  customSrc?: string
): { src: string; source: StateImageSource } {
  const idle = resolveAssistantImage(settings).src;
  if (state === "idle") return { src: idle, source: "idle" };
  if (state === "custom") return customSrc ? { src: customSrc, source: "custom" } : { src: idle, source: "idle" };
  const custom =
    state === "thinking" ? settings.thinkingImageUrl : state === "unresolved" ? settings.unresolvedImageUrl : settings.lifeInfoImageUrl;
  if (custom) return { src: custom, source: "custom" };
  const bundled = BUNDLED_STATE_IMAGES[state];
  if (bundled) return { src: bundled, source: "bundled" };
  return { src: idle, source: "idle" };
}
