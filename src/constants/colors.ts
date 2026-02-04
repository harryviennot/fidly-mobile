/**
 * Stampeo Design System Colors
 * Extracted from the showcase website design language
 */

export const StampeoColors = {
  light: {
    // Backgrounds
    background: '#f0efe9',      // Soft warm gray - main app background
    paper: '#faf9f6',           // Cream - card/surface backgrounds
    paperHover: '#f5f4f0',

    // Primary/Text
    text: '#2d3436',            // Dark slate - primary text
    textMuted: '#6b7280',       // Secondary text
    textLight: '#9ca3af',       // Tertiary text

    // Accent (Terracotta/Burnt orange)
    accent: '#f97316',          // Primary CTA color
    accentHover: '#ea580c',
    accentLight: '#f5ebe7',
    accentMuted: 'rgba(249, 115, 22, 0.1)',

    // Stamp decorative colors
    stampTerracotta: '#f97316',
    stampCoral: '#e07b5d',
    stampSand: '#d4a574',
    stampSage: '#7d9f7d',

    // Neutrals
    muted: '#e8e6e1',
    mutedGray: '#8c655a',
    border: '#ddd9d0',
    borderLight: '#e8e6e1',

    // Semantic colors
    success: '#22c55e',
    error: '#dc2626',
    warning: '#f59e0b',
    reward: '#FF9800',

    // Icon colors
    icon: '#6b7280',
    iconSelected: '#f97316',

    // Tint (for navigation/active states)
    tint: '#f97316',
    tabIconDefault: '#6b7280',
    tabIconSelected: '#f97316',
  },

  dark: {
    // Backgrounds
    background: '#151718',
    paper: '#1e2324',
    paperHover: '#262b2d',

    // Primary/Text
    text: '#ECEDEE',
    textMuted: '#9BA1A6',
    textLight: '#6b7280',

    // Accent (Terracotta - consistent across modes)
    accent: '#f97316',
    accentHover: '#fb923c',
    accentLight: 'rgba(249, 115, 22, 0.15)',
    accentMuted: 'rgba(249, 115, 22, 0.1)',

    // Stamp decorative colors
    stampTerracotta: '#f97316',
    stampCoral: '#e07b5d',
    stampSand: '#d4a574',
    stampSage: '#7d9f7d',

    // Neutrals
    muted: '#2d3436',
    mutedGray: '#8c655a',
    border: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(255, 255, 255, 0.15)',

    // Semantic colors
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    reward: '#FF9800',

    // Icon colors
    icon: '#9BA1A6',
    iconSelected: '#f97316',

    // Tint
    tint: '#f97316',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#f97316',
  },
};

// Design system spacing and radii
export const StampeoSpacing = {
  borderRadius: 10,
  borderRadiusSmall: 6,
  borderRadiusLarge: 16,
  borderRadiusFull: 9999,     // Pill buttons
};

// Helper to get colors based on color scheme
export function getStampeoColors(colorScheme: 'light' | 'dark' = 'light') {
  return StampeoColors[colorScheme];
}
