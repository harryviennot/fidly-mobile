import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";

interface PointsProgressProps {
  /** Current points balance. */
  value: number;
  /** Next reward threshold above value, or null when the top reward is reached. */
  nextThreshold: number | null;
  /** Name of the next reward (for the "N pts to {reward}" label). */
  nextRewardName?: string | null;
  /**
   * Balance before the action that led here. When set, the bar starts at that
   * fill and sweeps to the new one (instead of filling from empty), so the
   * animation reads as "what this scan changed".
   */
  previousValue?: number;
}

/** Progress toward the next reward: a label + a bar that sweeps to the new fill. */
export function PointsProgress({
  value,
  nextThreshold,
  nextRewardName,
  previousValue,
}: PointsProgressProps) {
  const { t } = useTranslation("points");
  const { theme } = useTheme();

  const atTop = nextThreshold == null;
  const pctOf = (v: number) => (atTop ? 1 : Math.max(0, Math.min(1, v / nextThreshold)));
  const fillPct = pctOf(value);
  const remaining = atTop ? 0 : Math.max(0, nextThreshold - value);

  const progress = useSharedValue(previousValue != null ? pctOf(previousValue) : 0);
  useEffect(() => {
    // Small delay so the sweep lands after the screen's entering animations.
    progress.value = withDelay(
      250,
      withTiming(fillPct, { duration: 650, easing: Easing.out(Easing.cubic) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillPct]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%", alignItems: "center", gap: 8 },
        label: { fontSize: 15, color: theme.textSecondary, textAlign: "center" },
        track: {
          width: "100%",
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.stampEmpty,
          overflow: "hidden",
        },
        fill: { height: "100%", borderRadius: 4, backgroundColor: theme.primary },
      }),
    [theme]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {atTop
          ? t("success.topReward")
          : t("success.toNextReward", { count: remaining, reward: nextRewardName ?? "" })}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}
