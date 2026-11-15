"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import HomeSearch from "./HomeSearch";
import IpLayoutPreviewBridge, { isIpPreview } from "./home/IpLayoutPreviewBridge";
import { IpCharId, IpDevice, IpLayouts, buildIpLayoutCss, deviceForWidth, ipClass, mobileHasVisible } from "@/lib/home/ipLayout";
import type { HeroImage } from "@/lib/home/ipImages";
import DialogueBubble from "./DialogueBubble";
import type { MobileIpCharacterSettings } from "@/lib/serverData";

export type HeroDialogue = { lines: { zh: string; en: string }[]; enabled: boolean } | null;

const BOUNCE_KEYFRAMES = {
  scale: [1, 0.86, 1.12, 0.97, 1],
  y: [0, 2, -16, 4, 0],
  transition: { duration: 0.55, ease: "easeInOut" as const },
};

/** 目前視窗屬於哪一種裝置（斷點與版面 CSS 相同）。伺服器端／第一次繪製先當桌機，掛載後立刻更正；只影響對話框方向與動畫參數，不影響位置（位置由 CSS 媒體查詢決定）。 */
function useIpDevice(): IpDevice {
  const [device, setDevice] = useState<IpDevice>("desktop");
  useEffect(() => {
    const update = () => setDevice(deviceForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return device;
}

/**
 * 可愛的、點擊會彈跳的吉祥物。位置／大小／角度全部由後台「IP 角色版面」的設定產生的 CSS 決定（見 lib/home/ipLayout.ts），
 * 這裡只負責：外層定位容器（含對話框，不旋轉）、內層旋轉／翻轉、最內層浮動與點擊彈跳動畫。
 */
function HeroCharacterFigure({
  id,
  image,
  settings,
  floatDelay,
  floatAmplitude = 18,
  floatDuration = 4.5,
  floatEnabled = true,
  dialogue,
  dialogueOpen,
  onToggleDialogue,
  editMode,
}: {
  id: IpCharId;
  image: HeroImage;
  settings: { x: number; y: number; visible: boolean };
  floatDelay: number;
  floatAmplitude?: number;
  floatDuration?: number;
  floatEnabled?: boolean;
  dialogue?: HeroDialogue;
  dialogueOpen?: boolean;
  onToggleDialogue?: () => void;
  editMode?: boolean;
}) {
  const bounceControls = useAnimation();
  const { lang } = useLanguage();
  const [lineIndex, setLineIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const hasLines = !!dialogue?.enabled && (dialogue?.lines.length ?? 0) > 0;
  const activeLine = hasLines ? dialogue!.lines[lineIndex % dialogue!.lines.length] : null;
  const dialogueText = activeLine ? (lang === "zh-TW" ? activeLine.zh : activeLine.en) || activeLine.zh : "";

  // 後台換了新圖片之後，重新給它一次載入的機會
  useEffect(() => setImgFailed(false), [image.src]);

  function handleClick() {
    if (editMode) return; // 後台預覽：不彈跳、不開對話框
    bounceControls.start(BOUNCE_KEYFRAMES);
    if (hasLines) {
      // 每次點擊都從這隻角色自己的回覆裡重新隨機抽一句（陣列只有一句就一直顯示那句）。
      setLineIndex(Math.floor(Math.random() * dialogue!.lines.length));
      onToggleDialogue?.();
    }
  }

  // 對話框方向跟著角色目前的位置走：偏右的角色往左展開、偏左的往右展開；偏下的在上方、偏上的在下方，不會超出主視覺區。
  const bubbleClass = `${settings.x >= 50 ? "right-0" : "left-0"} ${settings.y >= 45 ? "bottom-full mb-2" : "top-full mt-2"}`;
  // 內建圖有已知寬高可預留比例；後台上傳的圖片依原圖比例自動決定高度（h-auto）。圖片載入失敗就退回內建圖。
  const src = imgFailed ? image.src.startsWith("/images/") ? image.src : FALLBACK[id].src : image.src;

  return (
    <div
      data-ip-id={id}
      data-ip-hidden={editMode && !settings.visible ? "1" : "0"}
      className={`absolute z-10 ${ipClass(id)} ${editMode && !settings.visible ? "opacity-30" : ""}`}
    >
      {dialogueOpen && dialogueText && (
        <DialogueBubble text={dialogueText} className={bubbleClass} maxWidthClass="max-w-[min(62vw,280px)] lg:max-w-[300px]" />
      )}
      <div className="ipr cursor-pointer select-none" role="button" tabIndex={0} aria-label="Mascot" onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: floatEnabled ? [0, -floatAmplitude, 0] : 0 }}
          transition={{ opacity: { duration: 0.8 }, y: floatEnabled ? { duration: floatDuration, repeat: Infinity, ease: "easeInOut", delay: floatDelay } : { duration: 0.8 } }}
        >
          <motion.div animate={bounceControls}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              width={image.width || undefined}
              height={image.height || undefined}
              draggable={false}
              onError={() => setImgFailed(true)}
              className="block h-auto w-full object-contain drop-shadow-xl"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

const FALLBACK: Record<IpCharId, { src: string }> = {
  characterA: { src: "/images/brand/character-a-beginner.png" },
  characterB: { src: "/images/brand/character-b-leader.png" },
  characterC: { src: "/images/brand/character-c-cloud.png" },
};

export default function HeroBanner({
  mobileIpCharacters,
  ipLayouts,
  heroImages,
  hideMobileIp = false,
  title,
  subtitle,
  siteName,
  ipDialogues,
  decorations,
}: {
  decorations?: React.ReactNode;
  /** 「手機版管理」的動畫設定（浮動開關／幅度／週期），只套用在手機尺寸；位置與大小由 ipLayouts 決定。 */
  mobileIpCharacters: MobileIpCharacterSettings[];
  /** 三隻角色 × 三種裝置的版面（後台「IP 角色版面」儲存的設定；沒儲存的裝置用該裝置自己的預設值） */
  ipLayouts: IpLayouts;
  /** 每隻角色實際使用的圖片（後台上傳的優先，沒有才用內建圖） */
  heroImages: Record<IpCharId, HeroImage>;
  /** 「手機版管理」關閉 IP 角色列時，手機一律不顯示 */
  hideMobileIp?: boolean;
  title?: string;
  subtitle?: string;
  siteName?: string;
  ipDialogues?: { characterA: HeroDialogue; characterB: HeroDialogue; characterC: HeroDialogue };
}) {
  // 哪一隻角色的對話框正在開——一次只會有一個，點別隻會把目前開著的關掉，
  // 不會三個對話框同時出現。
  const [activeDialogue, setActiveDialogue] = useState<"characterA" | "characterB" | "characterC" | null>(null);
  function activate(key: "characterA" | "characterB" | "characterC") {
    setActiveDialogue(key);
  }
  const { t } = useLanguage();
  const device = useIpDevice();
  // 後台預覽（iframe + ?ipPreview=1）：用父頁面傳來的草稿版面覆蓋，並讓被隱藏的角色以淡色顯示，方便選取
  const [previewLayouts, setPreviewLayouts] = useState<IpLayouts | null>(null);
  const [editMode, setEditMode] = useState(false);
  useEffect(() => setEditMode(isIpPreview()), []);
  const onPreviewLayouts = useCallback((l: IpLayouts) => setPreviewLayouts(l), []);
  const layouts = previewLayouts ?? ipLayouts;
  const css = useMemo(() => {
    const forCss: IpLayouts = editMode
      ? (Object.fromEntries(Object.entries(layouts).map(([k, v]) => [k, { desktop: { ...v.desktop, visible: true }, tablet: { ...v.tablet, visible: true }, mobile: { ...v.mobile, visible: true } }])) as IpLayouts)
      : layouts;
    return buildIpLayoutCss(forCss, { hideMobile: hideMobileIp && !editMode });
  }, [layouts, editMode, hideMobileIp]);
  const mobileAnim = (id: IpCharId) => mobileIpCharacters.find((c) => c.id === id);
  const FLOAT: Record<IpCharId, { delay: number; amp: number }> = { characterA: { delay: 1.5, amp: 14 }, characterB: { delay: 0, amp: 18 }, characterC: { delay: 3, amp: 16 } };
  const figure = (id: IpCharId) => {
    const m = device === "mobile" ? mobileAnim(id) : undefined;
    return (
      <HeroCharacterFigure
        key={id}
        id={id}
        image={heroImages[id]}
        settings={layouts[id][device]}
        floatDelay={FLOAT[id].delay}
        floatAmplitude={m ? m.animationAmplitude : FLOAT[id].amp}
        floatDuration={m ? m.animationDuration : 4.5}
        floatEnabled={m ? m.animationEnabled : true}
        dialogue={ipDialogues?.[id]}
        dialogueOpen={activeDialogue === id}
        onToggleDialogue={() => activate(id)}
        editMode={editMode}
      />
    );
  };

  return (
    <section data-home-hero className="relative overflow-hidden bg-transit-500 dark:bg-transit-800">
      {/* animated background: drifting "route lines" evoking the MRT map motif */}
      <div className="pointer-events-none absolute inset-0 opacity-25">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute h-px w-[140%] bg-lantern-200"
            style={{ top: `${20 + i * 28}%`, left: "-20%" }}
            animate={{ x: ["0%", "6%", "0%"] }}
            transition={{ duration: 8 + i * 2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          className="absolute h-40 w-40 rounded-full bg-lantern-400/40 blur-3xl"
          style={{ top: "10%", right: "10%" }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute h-56 w-56 rounded-full bg-lantern-400/30 blur-3xl"
          style={{ bottom: "-10%", left: "5%" }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      {/* 首頁裝飾圖樣（hero 區）：在橫幅背景動畫之後、所有內容與 IP 角色之前，層級固定為「橫幅底色 → 裝飾 → 內容」 */}
      {decorations}

      {/* 三隻 IP 角色——一律同時顯示、不輪播。位置／大小／角度來自後台「IP 角色版面」（桌機、平板、手機各自一組，
          以本區塊為唯一定位基準的百分比座標，見 lib/home/ipLayout.ts）；圖層：橫幅底色 → 裝飾 PNG → 文字資訊與 IP 角色（z-10）。 */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <IpLayoutPreviewBridge onLayouts={onPreviewLayouts} />
      {figure("characterC")}
      {figure("characterA")}
      {figure("characterB")}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-28 sm:pb-52 lg:pb-60 xl:pb-72">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 text-white text-xs font-medium px-3.5 py-1.5 backdrop-blur-sm">
            🇹🇼 {siteName || "南得遇見你"}
          </span>
          <h1 className="mt-5 font-display text-3xl sm:text-5xl font-bold text-white leading-tight">
            {title || t("hero_title")}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/85 leading-relaxed">
            {subtitle || t("hero_subtitle")}
          </p>

          <div className="mt-7">
            <HomeSearch />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/life"
              className="inline-flex items-center gap-2 rounded-full bg-lantern-500 hover:bg-lantern-600 text-white font-medium px-6 py-3 transition-colors shadow-soft"
            >
              {t("hero_cta")}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/campus"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 transition-colors backdrop-blur-sm"
            >
              <MapPinned size={16} />
              {t("hero_cta_secondary")}
            </Link>
          </div>

          {/* 手機（< 640px）：在按鈕下方預留一排角色的位置，讓深色背景自然撐高、角色不會壓到文字。
              角色本身是絕對定位（和平板、桌機同一套機制），預設排在這一排裡；管理員可以在後台自由移動。 */}
          {mobileHasVisible(layouts, hideMobileIp && !editMode) && <div className="sm:hidden mt-8" style={{ height: "clamp(90px, 26vw, 130px)" }} aria-hidden />}
        </motion.div>
      </div>
    </section>
  );
}
