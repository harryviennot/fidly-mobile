/**
 * The look of every pre-login screen: welcome, sign in, sign up, join.
 *
 * These screens deliberately do NOT read `theme-context`. They render before
 * the employee belongs to a business, so there is no brand accent to honour yet
 * and no dark-mode preference loaded — one fixed, high-contrast light surface is
 * both simpler and more legible under a shop's ceiling lights.
 *
 * The intent is "counter-ready tool": a piece of equipment for a business, not
 * a consumer app. That translates to full-bleed layout instead of a floating
 * card, oversized left-aligned type, and tall rectangular action blocks with a
 * 12px radius. Pill buttons and centered cards are what we moved away from.
 */

export const colors = {
  /** Page background. Warm paper, never pure white. */
  paper: "#f0efe9",
  /** Raised surface: input fields, sheet body. */
  surface: "#faf9f6",
  /** Hairline borders and field outlines. */
  line: "#ddd9d0",
  /** Primary text. */
  ink: "#2d3436",
  /** Secondary text: subtitles, helper copy. */
  inkSoft: "#6b7280",
  /** Placeholder text and disabled glyphs. */
  inkFaint: "#9ca3af",
  /** The brand orange. One primary action per screen, and only one. */
  brand: "#f97316",
  /** Text and icons sitting on `brand`. */
  onBrand: "#ffffff",
  /** Errors. */
  danger: "#dc2626",
  dangerSurface: "rgba(220, 38, 38, 0.08)",
  dangerLine: "rgba(220, 38, 38, 0.20)",
  /** Success, used sparingly (password rules met). */
  good: "#15803d",
} as const;

export const radius = {
  /** Fields, blocks, sheet corners. Square-ish on purpose. */
  block: 12,
  /** Sheet top corners. */
  sheet: 24,
  /** Only for genuinely round things (avatars, badges). */
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  /** Screen headline. Big, tight, left-aligned. */
  display: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8, lineHeight: 38 },
  /** Secondary headline, used inside sheets and sub-steps. */
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4, lineHeight: 29 },
  /** Sentence under a headline. */
  lead: { fontSize: 16, fontWeight: "400", lineHeight: 23 },
  /** Action block title. */
  action: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  /** Action block second line, field labels when paired. */
  actionSub: { fontSize: 13, fontWeight: "500" },
  /** Body copy. */
  body: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  /** Uppercase micro-label above fields and sections. */
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  /** Quiet tertiary link. */
  link: { fontSize: 14, fontWeight: "600" },
} as const;

/** Minimum tap target for a block action. Thumb-sized, gloves-on-a-counter sized. */
export const BLOCK_HEIGHT = 68;
