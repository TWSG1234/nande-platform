/** "#2D6A6A" → "45 106 106"（Tailwind 的 rgb(var(--x) / <alpha-value>) 格式需要空白分隔的 R G B，不能是逗號或 #16 進位）。 */
export function hexToRgbTriplet(hex: string, fallback: string): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const hexBody = match?.[1];
  if (!hexBody) return fallback;
  const int = parseInt(hexBody, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `${r} ${g} ${b}`;
}
