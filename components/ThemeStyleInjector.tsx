import { getSiteAppearance } from "@/lib/serverData";
import { hexToRgbTriplet } from "@/lib/theme";

/**
 * 把 /admin/appearance 存的顏色，轉成 CSS 變數蓋掉 app/globals.css 裡的
 * :root 預設值。放在 <head> 裡用一個小 <style> 標籤輸出，全站任何用到
 * bg-transit-500／text-ink-900／bg-canvas-light 的既有 class 都會自動套用，
 * 不需要逐一修改元件。
 */
export default async function ThemeStyleInjector() {
  const appearance = await getSiteAppearance();

  const css = `:root {
  --color-primary: ${hexToRgbTriplet(appearance.primaryColor, "45 106 106")};
  --color-secondary: ${hexToRgbTriplet(appearance.secondaryColor, "255 111 60")};
  --color-bg-light: ${hexToRgbTriplet(appearance.backgroundColor, "250 250 247")};
  --color-text: ${hexToRgbTriplet(appearance.textColor, "27 27 27")};
  --color-card: ${hexToRgbTriplet(appearance.cardColor, "255 255 255")};
  --color-navbar: ${hexToRgbTriplet(appearance.navbarColor, "250 250 247")};
  --color-footer: ${hexToRgbTriplet(appearance.footerColor, "255 255 255")};
  --color-annotation: ${hexToRgbTriplet(appearance.buttonColor, "42 110 162")};
}`;

  // eslint-disable-next-line react/no-danger
  return <style id="theme-vars" dangerouslySetInnerHTML={{ __html: css }} />;
}
