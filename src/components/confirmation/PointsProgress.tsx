import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";

interface PointsProgressProps {
  /** Current points balance. */
  value: number;
  /** Next reward threshold above value, or null when the top reward is reached. */
  nextThreshold: number | null;
  /** Name of the next reward (for the "N pts to {reward}" label). */
  nextRewardName?: string | null;
}

/** Progress toward the next reward: a label + a bar that fills on mount. */
export function PointsProgress({ value, nextThreshold, nextRewardName }: PointsProgressProps) {
  const { t } = useTranslation("points");
  const { theme } = useTheme();

  const atTop = nextThreshold == null;
  const fillPct = atTop ? 1 : Math.max(0, Math.min(1, value / nextThreshold));
  const remaining = atTop ? 0 : Math.max(0, nextThreshold - value);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(fillPct, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [fillPct, progress]);
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
