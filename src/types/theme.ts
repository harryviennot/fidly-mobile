import type { CardDesign } from "./api";
import {
  isLightColor,
  adjustBrightness,
  blendColors,
  getContrastingTextColor,
} from "../utils/colors";

/**
 * Scanner app theme colors derived from business card design
 */
export interface ScannerTheme {
  // Primary brand colors (from card design)
  primary: string; // background_color - main brand color
  primaryText: string; // foreground_color - text on primary
  accent: string; // stamp_filled_color - highlight color

  // UI colors (derived)
  background: string; // Screen background
  surface: string; // Card/elevated surface
  text: string; // Primary text color
  textSecondary: string; // Secondary/muted text
  border: string; // Border/divider color

  // Stamp-specific
  stampFilled: string;
  stampEmpty: string;
  stampBorder: string;

  // Loading indicator
  loadingColor: string;
}

/**
 * Default theme (orange - matches current hardcoded colors)
 */
export const DEFAULT_THEME: ScannerTheme = {
  primary: "rgb(249, 115, 22)", // #f97316
  primaryText: "rgb(255, 255, 255)",
  accent: "rgb(249, 115, 22)",
  background: "rgb(240, 239, 233)", // #f0efe9
  surface: "rgb(250, 249, 246)", // #faf9f6
  text: "rgb(45, 52, 54)", // #2d3436
  textSecondary: "rgb(107, 114, 128)", // #6b7280
  border: "rgb(221, 217, 208)", // #ddd9d0
  stampFilled: "rgb(249, 115, 22)", // #f97316
  stampEmpty: "rgb(232, 230, 225)", // #e8e6e1
  stampBorder: "rgb(221, 217, 208)", // #ddd9d0
  loadingColor: "rgb(249, 115, 22)",
};

/**
 * Create a theme from a card design's colors
 */
export function createThemeFromDesign(design: CardDesign): ScannerTheme {
  // Use design colors if available, fall back to defaults
  const primary = design.background_color || DEFAULT_THEME.primary;
  const primaryText = design.foreground_color || DEFAULT_THEME.primaryText;
  const stampFilled = design.stamp_filled_color || primary;
  const stampEmpty = design.stamp_empty_color || DEFAULT_THEME.stampEmpty;
  const stampBorder = design.stamp_border_color || DEFAULT_THEME.stampBorder;

  // Derive UI colors based on primary
  // For light primary colors, we darken for accents; for dark, we use as-is
  const isPrimaryLight = isLightColor(primary);

  // Background should be a very light tint of the primary
  const background = isPrimaryLight
    ? blendColors(primary, "rgb(255, 255, 255)", 0.9)
    : blendColors(primary, "rgb(255, 255, 255)", 0.95);

  // Surface is slightly lighter than background
  const surface = blendColors(background, "rgb(255, 255, 255)", 0.5);

  // Border is a subtle version of the primary
  const border = blendColors(primary, "rgb(200, 200, 200)", 0.7);

  // Text colors based on background luminance
  const text = getContrastingTextColor(surface);
  const textSecondary = isLightColor(surface)
    ? "rgb(107, 114, 128)"
    : "rgb(180, 180, 180)";

  return {
    primary,
    primaryText,
    accent: stampFilled,
    background,
    surface,
    text,
    textSecondary,
    border,
    stampFilled,
    stampEmpty,
    stampBorder,
    loadingColor: primary,
  };
}
