import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Star } from "phosphor-react-native";
import { useTheme } from "@/contexts/theme-context";
import { perkCallout } from "@/utils/levels";
import type { ProgramLevel } from "@/types/api";
import { SOFT_ENTER } from "@/components/confirmation/animations";
import { UNLOCK_AMBER, UNLOCK_TINT } from "@/components/confirmation/palette";
import { levelsTranslate } from "./translate";

interface PerkCalloutProps {
  /** The customer's level; nothing renders without perks to apply. */
  level: ProgramLevel | null | undefined;
}

/**
 * The perks the employee applies at the till, shown above the card because they
 * change the bill and must be seen before the customer is charged. Warm amber,
 * not red: nothing is wrong.
 */
export function PerkCallout({ level }: PerkCalloutProps) {
  const { t } = useTranslation("stamp");
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: {
          alignSelf: "stretch",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: UNLOCK_TINT,
          borderWidth: 1,
          borderColor: "rgba(245, 158, 11, 0.35)",
        },
        icon: { paddingTop: 1 },
        body: { flex: 1, gap: 2 },
        title: { fontSize: 15, fontWeight: "700", color: theme.text },
        line: { fontSize: 15, fontWeight: "600", color: theme.text },
        hint: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
      }),
    [theme]
  );

  const content = perkCallout(level, levelsTranslate(t));
  if (!content) return null;

  return (
    <Animated.View entering={SOFT_ENTER} style={styles.box}>
      <View style={styles.icon}>
        <Star size={18} color={UNLOCK_AMBER} weight="fill" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{content.title}</Text>
        {content.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
        <Text style={styles.hint}>{content.hint}</Text>
      </View>
    </Animated.View>
  );
}
