import BudiGrowthAnimation from "@/components/chinese/BudiGrowthAnimation";

/**
 * 答對動畫的「關卡 → 動畫」對應表，整個系統只有這一個地方決定每一關播哪一段動畫。
 *
 * 做法：
 * 1. ANIMATIONS：動畫 key → 動畫元件（每個 key 只對應一個元件，沒有複製程式碼）。
 *    目前只有校園的 8 段（campus_level_1 ~ campus_level_8），都是同一個
 *    BudiGrowthAnimation 元件，用 stage 參數決定畫面。
 * 2. LEVEL_ANIMATION_KEY：每個「分區 + 關卡」指向哪個動畫 key。
 *    生活 1～8 關目前暫時指向 campus_level_1～8。
 *
 * 之後要把生活換回真正的生活動畫：
 *   - 新增動畫元件（例如 components/chinese/PuffyDeliveryAnimation.tsx 已經保留，
 *     原本規劃的奶茶外送動畫還在，只是目前沒有使用），
 *   - 在 ANIMATIONS 加上 life_level_N，
 *   - 把 LEVEL_ANIMATION_KEY.life 對應的那一關改成 "life_level_N"，
 *   題目系統完全不用動。
 */
type AnimationRenderer = () => React.ReactElement;

const ANIMATIONS: Record<string, AnimationRenderer> = Object.fromEntries(
  Array.from({ length: 8 }, (_, i) => {
    const level = i + 1;
    return [`campus_level_${level}`, () => <BudiGrowthAnimation stage={level} />];
  })
);

const LEVEL_ANIMATION_KEY: Record<"life" | "campus", Record<number, string>> = {
  campus: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, `campus_level_${i + 1}`])),
  // 暫時：生活 1～8 關直接引用校園 1～8 關動畫（見上方說明）。
  life: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, `campus_level_${i + 1}`])),
};

export function getSuccessAnimationKey(track: "life" | "campus", levelNumber: number): string {
  return LEVEL_ANIMATION_KEY[track][levelNumber] ?? "campus_level_1";
}

export function renderSuccessAnimation(track: "life" | "campus", levelNumber: number): React.ReactElement {
  const render = ANIMATIONS[getSuccessAnimationKey(track, levelNumber)] ?? ANIMATIONS.campus_level_1!;
  return render();
}
