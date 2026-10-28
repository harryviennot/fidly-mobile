import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/contexts/theme-context";

interface LevelChipProps {
  /** The level's name, at most 16 characters on the backend. */
  name: string;
}

/**
 * A small pill with the customer's level name. Neutral on purpose: the scanner
 * wears the business's first card whatever level the customer is on, so the
 * chip borrows the theme's own surface and border and invents no tier colours.
 */
export function LevelChip({ name }: LevelChipProps) {
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          flexShrink: 0,
          maxWidth: 140,
          paddingVertical: 3,
          paddingHorizontal: 10,
          borderRadius: 9999,
          backgroundColor: theme.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
        text: { fontSize: 13, fontWeight: "700", color: theme.text },
      }),
    [theme]
  );

  return (
    <View style={styles.pill}>
      <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>
    </View>
  );
}
