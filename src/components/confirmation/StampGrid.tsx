import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTheme } from "@/contexts/theme-context";

interface StampGridProps {
  total: number;
  filled: number;
  /**
   * Pop the most recently filled dot in with a small spring — set on the
   * success screens so the stamp that was just added reads as new.
   */
  popLast?: boolean;
}

const POP_ENTER = ZoomIn.delay(200).springify().damping(16).stiffness(260);

/** The row of stamp dots (empty/filled), extracted from the stamp screen. */
export function StampGrid({ total, filled, popLast = false }: StampGridProps) {
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        },
        dot: {
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: theme.stampEmpty,
          borderWidth: 2,
          borderColor: theme.stampBorder,
        },
        dotFilled: {
          backgroundColor: theme.stampFilled,
          borderColor: theme.accent,
        },
      }),
    [theme]
  );

  return (
    <View style={styles.row}>
      {[...Array(total)].map((_, i) => {
        const isFilled = i < filled;
        if (popLast && isFilled && i === filled - 1) {
          return <Animated.View key={i} entering={POP_ENTER} style={[styles.dot, styles.dotFilled]} />;
        }
        return <View key={i} style={[styles.dot, isFilled && styles.dotFilled]} />;
      })}
    </View>
  );
}
