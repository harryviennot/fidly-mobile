import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/contexts/theme-context";

interface StampGridProps {
  total: number;
  filled: number;
}

/** The row of stamp dots (empty/filled), extracted from the stamp screen. */
export function StampGrid({ total, filled }: StampGridProps) {
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
      {[...Array(total)].map((_, i) => (
        <View key={i} style={[styles.dot, i < filled && styles.dotFilled]} />
      ))}
    </View>
  );
}
