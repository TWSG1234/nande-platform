import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 深青 — inspired by MRT signage teal, the platform's anchor color
        // 500 這個色階是「主色」，改用 CSS 變數（見 app/globals.css 的
        // :root 與 app/layout.tsx 的 ThemeStyleInjector），讓 /admin/appearance
        // 可以在不重新編譯的情況下即時換色；其餘色階維持原本寫死的漸層色，
        // 只是同一個主色的深淺變化，不需要每一階都能個別調整。
        transit: {
          50: "#EEF6F5",
          100: "#D3E8E6",
          200: "#A7D1CC",
          // 300~600 是網站裡最常被拿來當「主色」使用的四個色階（文字、
          // hover、icon、邊框都在用），這次全部跟著 --color-primary 走，
          // 不然管理員在後台改了主色，畫面上大部分地方還是舊的深青色。
          // 50/100/200/700/800/900 使用量很少、而且是拿來做「保證看得清楚
          // 的極淺/極深文字」用的，故意不跟著變，避免對比度出問題。
          300: "rgb(var(--color-primary) / <alpha-value>)",
          400: "rgb(var(--color-primary) / <alpha-value>)",
          500: "rgb(var(--color-primary) / <alpha-value>)", // primary
          600: "rgb(var(--color-primary) / <alpha-value>)",
          700: "#1C4343",
          800: "#143030",
          900: "#0D1F1F",
        },
        // 燈籠橘 — lantern / night-market coral, the accent（輔助色）
        lantern: {
          // lantern 的每個色階全部跟著 --color-secondary 走——不像 transit
          // 還有極端色階要保留對比度，lantern 在全站的用法都是「輔助色」
          // 本身（badge、hover、icon、小標籤），沒有需要保留舊橘色的地方。
          50: "rgb(var(--color-secondary) / <alpha-value>)",
          100: "rgb(var(--color-secondary) / <alpha-value>)",
          200: "rgb(var(--color-secondary) / <alpha-value>)",
          300: "rgb(var(--color-secondary) / <alpha-value>)",
          400: "rgb(var(--color-secondary) / <alpha-value>)",
          500: "rgb(var(--color-secondary) / <alpha-value>)", // accent
          600: "rgb(var(--color-secondary) / <alpha-value>)",
          700: "rgb(var(--color-secondary) / <alpha-value>)",
        },
        // 陽光黃 — sun / lantern-light secondary
        sunny: {
          300: "#FFE08A",
          400: "#FFD35F",
          500: "#FFC857",
          600: "#E6AC2E",
        },
        ink: {
          50: "#F7F7F5",
          100: "#EDEDE9",
          400: "#6B6F6E",
          600: "#3F4342",
          800: "#22201D",
          900: "rgb(var(--color-text) / <alpha-value>)", // 文字色
        },
        canvas: {
          light: "rgb(var(--color-bg-light) / <alpha-value>)", // 背景色
          dark: "#0F1717",
          darkcard: "#16201F",
        },
        // 卡片背景色／導覽列色／頁尾色——網站外觀後台可以個別調整的三個新色。
        card: "rgb(var(--color-card) / <alpha-value>)",
        navbar: "rgb(var(--color-navbar) / <alpha-value>)",
        footerbg: "rgb(var(--color-footer) / <alpha-value>)",
        // 特別註釋文字顏色（原本「按鈕色」欄位改用途——按鈕統一跟著主色／
        // 輔色走，不用獨立顏色，這個欄位改拿來管小標籤/eyebrow 這類的
        // 「特別註釋文字」）。
        annotation: "rgb(var(--color-annotation) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 2px 20px -4px rgba(20, 48, 48, 0.12)",
        softdark: "0 2px 24px -4px rgba(0, 0, 0, 0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.4)", opacity: "0.6" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
