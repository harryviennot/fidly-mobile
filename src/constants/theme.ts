/**
 * Stampeo Scanner Theme
 * Colors aligned with the Stampeo design language
 */

import { Platform } from 'react-native';
import { StampeoColors } from './colors';

// Re-export StampeoColors as Colors for backwards compatibility
export const Colors = {
  light: {
    text: StampeoColors.light.text,
    background: StampeoColors.light.background,
    tint: StampeoColors.light.tint,
    icon: StampeoColors.light.icon,
    tabIconDefault: StampeoColors.light.tabIconDefault,
    tabIconSelected: StampeoColors.light.tabIconSelected,
    // Extended Stampeo colors
    paper: StampeoColors.light.paper,
    accent: StampeoColors.light.accent,
    accentHover: StampeoColors.light.accentHover,
    border: StampeoColors.light.border,
    textMuted: StampeoColors.light.textMuted,
    success: StampeoColors.light.success,
    error: StampeoColors.light.error,
  },
  dark: {
    text: StampeoColors.dark.text,
    background: StampeoColors.dark.background,
    tint: StampeoColors.dark.tint,
    icon: StampeoColors.dark.icon,
    tabIconDefault: StampeoColors.dark.tabIconDefault,
    tabIconSelected: StampeoColors.dark.tabIconSelected,
    // Extended Stampeo colors
    paper: StampeoColors.dark.paper,
    accent: StampeoColors.dark.accent,
    accentHover: StampeoColors.dark.accentHover,
    border: StampeoColors.dark.border,
    textMuted: StampeoColors.dark.textMuted,
    success: StampeoColors.dark.success,
    error: StampeoColors.dark.error,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
