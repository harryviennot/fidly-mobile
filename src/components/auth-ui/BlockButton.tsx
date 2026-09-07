import { useEffect, useRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon } from "phosphor-react-native";
import { BLOCK_HEIGHT, colors, radius, spacing, type } from "./tokens";

export type BlockVariant = "primary" | "outline" | "quiet";

interface BlockButtonProps {
  title: string;
  /** Optional second line: what this choice actually means. */
  subtitle?: string;
  onPress: () => void;
  variant?: BlockVariant;
  /** Leading glyph (a provider mark, an icon). */
  icon?: ReactNode;
  /** Trailing arrow. On by default for primary/outline. */
  showArrow?: boolean;
  /** Small right-aligned note, e.g. "Last used". */
  badge?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const PRESS_SCALE = 0.975;

/**
 * The one action shape these screens use. Tall enough to hit without looking,
 * wide enough to carry a second line of explanation, and it answers a press
 * physically: a small scale-down plus a light haptic tick, so the tap registers
 * even in a loud room where nothing is audible.
 *
 * Reduced-motion is honoured by skipping the scale (the haptic stays: it is
 * feedback, not decoration).
 */
export function BlockButton({
  title,
  subtitle,
  onPress,
  variant = "outline",
  icon,
  showArrow,
  badge,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  testID,
}: BlockButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);

  // Read once per mount rather than subscribing: these screens are short-lived
  // and a mid-press preference change is not worth a listener.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) reduceMotion.current = enabled;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const isQuiet = variant === "quiet";
  const inactive = disabled || loading;
  const arrow = showArrow ?? !isQuiet;

  const animate = (toValue: number) => {
    if (reduceMotion.current || isQuiet) return;
    Animated.spring(scale, {
      toValue,
      damping: 20,
      stiffness: 400,
      mass: 0.6,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const handlePress = () => {
    if (inactive) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  const tone =
    variant === "primary"
      ? { block: styles.primary, title: styles.primaryTitle, sub: styles.primarySub }
      : variant === "outline"
        ? { block: styles.outline, title: styles.outlineTitle, sub: styles.outlineSub }
        : { block: styles.quiet, title: styles.quietTitle, sub: styles.outlineSub };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => animate(PRESS_SCALE)}
        onPressOut={() => animate(1)}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        testID={testID}
        style={[styles.block, tone.block, inactive && styles.inactive]}
      >
        {/* The spinner takes the icon's place rather than replacing the whole
            row: the label is what tells the employee which provider they are
            waiting on, so it has to survive the wait. */}
        {loading || icon ? (
          <View style={styles.icon}>
            {loading ? (
              <ActivityIndicator
                color={variant === "primary" ? colors.onBrand : colors.ink}
              />
            ) : (
              icon
            )}
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={[styles.title, tone.title]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, tone.sub]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {arrow && !loading ? (
          <ArrowRightIcon
            size={20}
            weight="bold"
            color={variant === "primary" ? colors.onBrand : colors.ink}
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    minHeight: BLOCK_HEIGHT,
    borderRadius: radius.block,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  primary: {
    backgroundColor: colors.brand,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  quiet: {
    backgroundColor: "transparent",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  inactive: {
    opacity: 0.5,
  },
  icon: {
    width: 24,
    alignItems: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.action,
  },
  primaryTitle: {
    color: colors.onBrand,
  },
  outlineTitle: {
    color: colors.ink,
  },
  quietTitle: {
    ...type.link,
    color: colors.ink,
    textDecorationLine: "underline",
  },
  subtitle: {
    ...type.actionSub,
  },
  primarySub: {
    color: "rgba(255,255,255,0.85)",
  },
  outlineSub: {
    color: colors.inkSoft,
  },
  badge: {
    backgroundColor: colors.paper,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.inkSoft,
  },
});
