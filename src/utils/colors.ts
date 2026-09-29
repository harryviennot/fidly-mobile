/**
 * Color utility functions. Card designs store colours as "rgb(r, g, b)", but any
 * CSS-style form is read (rgb/rgba, #rgb, #rgba, #rrggbb, #rrggbbaa) so a colour
 * written by another client never falls through as unreadable.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

const RGB_FUNCTION = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+%?\s*)?\)$/i;
const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Parse a colour to { r, g, b } (alpha ignored), or null when it is unreadable.
 */
export function parseRgb(color: string | null | undefined): RGB | null {
  if (typeof color !== "string") return null;
  const value = color.trim();

  const fn = RGB_FUNCTION.exec(value);
  if (fn) {
    const [r, g, b] = [fn[1], fn[2], fn[3]].map((c) => Math.min(255, Number.parseInt(c, 10)));
    return { r, g, b };
  }

  const hex = HEX.exec(value);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * The colour as "rgb(r, g, b)", or null when it is unreadable.
 */
export function normalizeColor(color: string | null | undefined): string | null {
  const rgb = parseRgb(color);
  return rgb ? toRgbString(rgb) : null;
}

/**
 * Convert RGB object to rgb() string
 */
export function toRgbString(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Calculate relative luminance (0-1) using WCAG formula
 * Higher values = lighter colors
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine if a color is "light" (luminance > 0.5)
 */
export function isLightColor(rgbString: string): boolean {
  const rgb = parseRgb(rgbString);
  if (!rgb) return false;
  return getLuminance(rgb.r, rgb.g, rgb.b) > 0.5;
}

/**
 * Create rgba string with alpha
 */
export function withOpacity(rgbString: string, alpha: number): string {
  const rgb = parseRgb(rgbString);
  if (!rgb) return rgbString;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Lighten or darken a color by a given amount (-255 to 255)
 */
export function adjustBrightness(rgbString: string, amount: number): string {
  const rgb = parseRgb(rgbString);
  if (!rgb) return rgbString;
  const adjust = (v: number) => Math.max(0, Math.min(255, v + amount));
  return `rgb(${adjust(rgb.r)}, ${adjust(rgb.g)}, ${adjust(rgb.b)})`;
}

/**
 * Blend two colors together (0 = first color, 1 = second color)
 */
export function blendColors(
  color1: string,
  color2: string,
  ratio: number
): string {
  const rgb1 = parseRgb(color1);
  const rgb2 = parseRgb(color2);
  if (!rgb1 || !rgb2) return color1;

  const blend = (a: number, b: number) => Math.round(a + (b - a) * ratio);
  return `rgb(${blend(rgb1.r, rgb2.r)}, ${blend(rgb1.g, rgb2.g)}, ${blend(rgb1.b, rgb2.b)})`;
}

/**
 * Get a contrasting text color (black or white) based on background
 */
export function getContrastingTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor)
    ? "rgb(45, 52, 54)" // dark text
    : "rgb(255, 255, 255)"; // white text
}
