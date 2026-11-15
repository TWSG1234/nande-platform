"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound, RotateCw, ImageIcon, CreditCard } from "lucide-react";

export type IpCharacterCardData = {
  id: string;
  name: string;
  image: string; // 正面「人物」照
  positionZh?: string;
  positionEn?: string;
  personalityZh?: string;
  personalityEn?: string;
  quoteZh?: string;
  quoteEn?: string;
  conceptTitleZh?: string;
  conceptTitleEn?: string;
  introZh?: string; // 背面「設計理念內容」
  introEn?: string;
  backImage?: string | null; // 背面「卡牌圖」
  backImageWidth?: number | null;
  backImageHeight?: number | null;
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
};

/**
 * 橫式「角色身分卡」，可以點擊/按 Enter 翻面。正面／背面是同一張卡片，用
 * CSS 3D 翻轉（perspective + preserve-3d + backface-visibility）呈現。
 *
 * 這張卡完全是資料驅動的：
 * - 顏色（bgColor/borderColor/textColor/accentColor）是每隻角色自己的一套，
 *   從管理後台存進資料庫，不是寫死在這個檔案裡的 Tailwind class——所以這裡
 *   大量用 inline style 而不是 className 控制顏色，運行時的動態顏色沒辦法
 *   用 Tailwind 的靜態 class 表達。
 * - 背面卡牌圖用 aspect-ratio（從 backImageWidth/backImageHeight 算出來）+
 *   object-fit: contain 呈現，不會被拉伸或裁切成固定形狀；不同角色的圖片
 *   比例不同，卡片裡的圖片區域也會跟著不同，但整張卡片本身尺寸不變。
 */
export default function IPCharacterCard({ data, lang }: { data: IpCharacterCardData; lang: "zh-TW" | "en" }) {
  const [isFlipped, setIsFlipped] = useState(false);

  function toggle() {
    setIsFlipped((f) => !f);
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  const isZh = lang === "zh-TW";
  const position = (isZh ? data.positionZh : data.positionEn) || (isZh ? data.positionEn : data.positionZh);
  const personality = (isZh ? data.personalityZh : data.personalityEn) || (isZh ? data.personalityEn : data.personalityZh);
  const quote = (isZh ? data.quoteZh : data.quoteEn) || (isZh ? data.quoteEn : data.quoteZh);
  const background = (isZh ? data.introZh : data.introEn) || (isZh ? data.introEn : data.introZh);
  const conceptTitle = (isZh ? data.conceptTitleZh : data.conceptTitleEn) || (isZh ? data.conceptTitleEn : data.conceptTitleZh);

  const backAspectRatio = data.backImageWidth && data.backImageHeight ? data.backImageWidth / data.backImageHeight : 0.78;

  const faceStyle: React.CSSProperties = {
    backgroundColor: data.bgColor,
    borderColor: data.borderColor,
    borderWidth: 2,
    borderStyle: "solid",
  };
  const bannerStyle: React.CSSProperties = { backgroundColor: data.borderColor };
  const textStyle: React.CSSProperties = { color: data.textColor };
  const mutedTextStyle: React.CSSProperties = { color: data.textColor, opacity: 0.65 };

  return (
    <div className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-[820px]" style={{ perspective: "2000px" }}>
      <div className="transition-transform duration-300 hover:-translate-y-1.5">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={isFlipped}
          aria-label={`${data.name} character card. Press Enter or click to flip.`}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          className="relative min-h-[640px] sm:min-h-[460px] lg:min-h-[520px] cursor-pointer select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.7s cubic-bezier(0.4, 0.15, 0.2, 1)",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* ── 正面 ───────────────────────────────────────────────── */}
          <div className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl shadow-soft dark:shadow-softdark" style={{ ...faceStyle, backfaceVisibility: "hidden" }}>
            <div className="flex shrink-0 items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3" style={bannerStyle}>
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] text-white sm:text-sm">
                <CreditCard size={16} /> ID CARD
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 sm:flex-row sm:gap-6 sm:p-6 lg:gap-8 lg:p-8">
              {/* 正面大頭照：容器在手機是正方形、桌面跟左右並排的那一排同高（自動拉滿），
                  圖片用 fill + object-contain 完整置中，維持原始比例，不會被拉伸或裁切。 */}
              <div
                className="relative aspect-square w-full shrink-0 overflow-hidden rounded-xl sm:aspect-auto sm:min-h-[220px] sm:w-[38%]"
                style={{ backgroundColor: data.accentColor + "26" }}
              >
                {data.image ? (
                  <Image
                    src={data.image}
                    alt={data.name}
                    fill
                    sizes="(min-width: 640px) 320px, 90vw"
                    className="object-contain p-2"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5" style={mutedTextStyle}>
                    <UserRound size={44} strokeWidth={1.5} />
                    <span className="text-center text-xs leading-tight">人物<br />待替換圖片</span>
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="border-b pb-2" style={{ borderColor: data.borderColor + "55" }}>
                    <p className="text-xs font-medium sm:text-sm" style={mutedTextStyle}>Name</p>
                    <p className="text-base font-semibold leading-snug sm:text-lg lg:text-xl" style={textStyle}>{data.name}</p>
                  </div>
                  {position && (
                    <div className="border-b pb-2" style={{ borderColor: data.borderColor + "55" }}>
                      <p className="text-xs font-medium sm:text-sm" style={mutedTextStyle}>{isZh ? "定位" : "Role"}</p>
                      <p className="text-base font-semibold leading-snug sm:text-lg" style={textStyle}>{position}</p>
                    </div>
                  )}
                  {personality && (
                    <div className="border-b pb-2" style={{ borderColor: data.borderColor + "55" }}>
                      <p className="text-xs font-medium sm:text-sm" style={mutedTextStyle}>{isZh ? "個性" : "Personality"}</p>
                      <p className="text-base font-semibold leading-snug sm:text-lg" style={textStyle}>{personality}</p>
                    </div>
                  )}
                </div>
                {quote && (
                  <p className="text-sm italic leading-relaxed sm:text-base" style={mutedTextStyle}>
                    「{quote}」
                  </p>
                )}
              </div>
            </div>

            <p className="flex shrink-0 items-center justify-center gap-1.5 pb-3 text-xs sm:pb-4 sm:text-sm" style={mutedTextStyle}>
              <RotateCw size={12} /> {isZh ? "點擊翻面" : "Tap to flip"}
            </p>
          </div>

          {/* ── 背面 ───────────────────────────────────────────────── */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl shadow-soft dark:shadow-softdark"
            style={{ ...faceStyle, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="h-2.5 shrink-0" style={bannerStyle} />

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6 sm:flex-row sm:gap-7 sm:p-8 lg:gap-9 lg:p-10">
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-lg font-semibold tracking-wide sm:text-2xl" style={{ color: data.borderColor }}>
                  {conceptTitle || (isZh ? "背景" : "Background")}
                </p>
                <p className="mt-4 text-lg leading-relaxed sm:text-xl sm:leading-loose" style={textStyle}>
                  {background}
                </p>
              </div>

              {/* 卡牌圖——用這張圖片自己的原始寬高比（aspect-ratio）決定外框，外框跟圖片
                  一樣大，所以圖片剛好填滿、不會有多餘留白，也不會被拉伸或裁切。手機
                  是置中的固定寬度（最寬 260px），桌面的高度跟著這一排的內容高度走
                  （最高 420px），寬度由比例自動算出。 */}
              {data.backImage ? (
                <div
                  className="relative w-full max-w-[260px] shrink-0 self-center sm:h-full sm:max-h-[420px] sm:w-auto sm:max-w-none"
                  style={{ aspectRatio: backAspectRatio }}
                >
                  <Image
                    src={data.backImage}
                    alt={`${data.name} card art`}
                    fill
                    sizes="(min-width: 640px) 300px, 260px"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div
                  className="flex w-full max-w-[260px] shrink-0 flex-col items-center justify-center gap-1.5 self-center rounded-xl sm:h-full sm:max-h-[420px] sm:w-auto"
                  style={{ ...mutedTextStyle, backgroundColor: data.accentColor + "26", aspectRatio: backAspectRatio }}
                >
                  <ImageIcon size={40} strokeWidth={1.5} />
                  <span className="text-center text-xs leading-tight">卡牌圖<br />待替換圖片</span>
                </div>
              )}
            </div>

            <p className="flex shrink-0 items-center justify-center gap-1.5 pb-3 text-xs sm:pb-4 sm:text-sm" style={mutedTextStyle}>
              <RotateCw size={12} /> {isZh ? "點擊翻回正面" : "Tap to flip back"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
