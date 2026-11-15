export interface HeroCharacter {
  /** Path under /public */
  src: string;
  /** Intrinsic pixel width/height of the source image (for aspect-ratio, not display size) */
  width: number;
  height: number;
  alt: string;
}

/**
 * The three mascot characters shown together on the homepage Hero.
 * All three always render at once — see HeroBanner.tsx. To swap a character,
 * just replace the file under /public/images/brand and update its
 * src/width/height here.
 */
export const heroCharacters: { characterA: HeroCharacter; characterB: HeroCharacter; characterC: HeroCharacter } = {
  characterA: {
    src: "/images/brand/character-a-beginner.png",
    width: 1274,
    height: 1072,
    alt: "",
  },
  characterB: {
    src: "/images/brand/character-b-leader.png",
    width: 1380,
    height: 997,
    alt: "",
  },
  characterC: {
    src: "/images/brand/character-c-cloud.png",
    width: 1160,
    height: 956,
    alt: "",
  },
};
