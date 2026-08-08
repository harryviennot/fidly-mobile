import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { blendColors, getContrastingTextColor } from "@/utils/colors";
import { EASE_OUT } from "@/constants/motion";

interface AmountDisplayProps {
  /** Raw keypad string in the locale separator (e.g. "12,50"). */
  amount: string;
  currencySymbol: string;
  /** Points credited for the typed amount, or null while the rate is unknown. */
  pointsPreview: number | null;
}

/**
 * The big purchase-amount readout + the live "≈ +N pts" conversion preview.
 * The amount gives a tiny pop on every keystroke so typing feels responsive;
 * the preview renders as a tinted pill in a fixed-height row so the layout
 * never shifts as it appears/disappears.
 */
export function AmountDisplay({ amount, currencySymbol, pointsPreview }: AmountDisplayProps) {
  const { t } = useTranslation("points");
  const { theme } = useTheme();

  // Keystroke pop: a quick 3% scale-up that eases straight back down. Timed
  // rather than sprung so fast typing never stacks up into a wobble.
  const pop = useSharedValue(1);
  const prevAmount = useRef(amount);
  useEffect(() => {
    if (amount !== prevAmount.current) {
      prevAmount.current = amount;
      pop.value = withSequence(
        withTiming(1.03, { duration: 60 }),
        withTiming(1, { duration: 140, easing: EASE_OUT })
      );
    }
  }, [amount, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const styles = useMemo(() => {
    // Pale brand-tint pill: the label must be contrast-derived from that tint,
    // not raw `theme.primary` (which vanishes on it for light brand colors).
    const previewPillBg = blendColors(theme.primary, theme.background, 0.86);
    return StyleSheet.create({
        wrap: { alignItems: "center", width: "100%" },
        amountRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
        amount: {
          fontSize: 52,
          fontWeight: "700",
          color: amount ? theme.text : theme.textSecondary,
          letterSpacing: 0.5,
        },
        currency: {
          fontSize: 28,
          fontWeight: "600",
          color: theme.textSecondary,
          marginLeft: 6,
          marginBottom: 6,
        },
        previewRow: { height: 34, justifyContent: "center", marginTop: 6 },
        previewPill: {
          paddingVertical: 5,
          paddingHorizontal: 14,
          borderRadius: 9999,
          backgroundColor: previewPillBg,
        },
        preview: {
          fontSize: 16,
          fontWeight: "600",
          color: getContrastingTextColor(previewPillBg),
        },
      });
  }, [theme, amount]);

  const showPreview = pointsPreview != null && pointsPreview > 0;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.amountRow, popStyle]}>
        <Text style={styles.amount}>{amount || "0"}</Text>
        <Text style={styles.currency}>{currencySymbol}</Text>
      </Animated.View>
      <View style={styles.previewRow}>
        {showPreview && (
          <Animated.View
            entering={ZoomIn.duration(200).easing(EASE_OUT)}
            exiting={FadeOut.duration(120)}
            style={styles.previewPill}
          >
            <Text style={styles.preview}>{t("amountPreview", { points: pointsPreview })}</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
