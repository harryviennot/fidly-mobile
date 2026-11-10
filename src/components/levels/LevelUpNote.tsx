import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { perkCallout, perksForLevelUp } from "./levels";
import type { LevelBrief, ProgramLevel } from "@/types/api";
import { levelsTranslate } from "./translate";

interface LevelUpNoteProps {
  /** The level the scan just moved the customer to. */
  levelUp: LevelBrief;
  /** The customer's level after a re-read, when the re-read succeeded. */
  current: ProgramLevel | null | undefined;
}

/**
 * The "Tell them" box on a level-up success: what the customer now gets, so
 * the employee has the sentence to say. Perks when the re-read confirmed them,
 * else what their card now shows.
 */
export function LevelUpNote({ levelUp, current }: LevelUpNoteProps) {
  const { t } = useTranslation("stamp");
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: {
          alignSelf: "stretch",
          gap: 4,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: theme.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
        label: { fontSize: 13, fontWeight: "700", color: theme.textSecondary },
        body: { fontSize: 16, fontWeight: "600", lineHeight: 22, color: theme.text },
      }),
    [theme]
  );

  const translate = levelsTranslate(t);
  const perks = perksForLevelUp(levelUp, current);
  const content = perks ? perkCallout(perks, translate) : null;

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{t("levels.tellThem")}</Text>
      {content ? (
        <>
          <Text style={styles.body}>{content.title}</Text>
          {content.lines.map((line) => (
            <Text key={line} style={styles.body}>
              {line}
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.body}>{t("levels.cardShows", { level: levelUp.name })}</Text>
      )}
    </View>
  );
}
