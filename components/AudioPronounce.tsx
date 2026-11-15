"use client";

import { useState } from "react";
import { Volume2, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Plays pronunciation for a piece of Chinese text using the browser's built-in
 * Web Speech API (SpeechSynthesis) — no audio files or backend needed.
 * Falls back gracefully (button becomes a no-op) in browsers without support.
 */
export default function AudioPronounce({ text, label }: { text: string; label?: string }) {
  const { t } = useLanguage();
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  function play() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-TW";
    utterance.rate = 0.9;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={play}
      disabled={!supported}
      aria-label={label ?? t("play_pronunciation")}
      title={supported ? label ?? t("play_pronunciation") : "Speech synthesis not supported in this browser"}
      className="h-8 w-8 flex items-center justify-center rounded-full bg-transit-500/10 text-transit-600 dark:text-transit-300 hover:bg-transit-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {playing ? <LoaderCircle size={15} className="animate-spin" /> : <Volume2 size={15} />}
    </button>
  );
}
