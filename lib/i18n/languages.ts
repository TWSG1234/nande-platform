import { LangCode } from "@/lib/types";

export interface LanguageOption {
  code: LangCode;
  nativeLabel: string;
  shortLabel: string;
}

export const languages: LanguageOption[] = [
  { code: "zh-TW", nativeLabel: "繁體中文", shortLabel: "中" },
  { code: "en", nativeLabel: "English", shortLabel: "EN" },
];
