import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";
import { useTheme } from "@/contexts/theme-context";
import { EASE_OUT } from "@/constants/motion";

interface StampGridProps {
  total: number;
  filled: number;
  /**
   * Stamps about to be added, drawn as ghost dots after the filled ones. Lets
   * the employee watch the card fill as they set the quantity, before anything
   * is committed.
   */
  pending?: number;
  /**
   * Pop the last N filled dots in with a staggered spring — set on the success
   * screens so the stamps that were just added read as new.
   */
  popCount?: number;
}

// Each newly-added dot lands a beat after the one before it, so a 5-stamp scan
// reads as five stamps rather than one lump.
const POP_STAGGER_MS = 70;
const POP_DELAY_MS = 200;
const GHOST_STAGGER_MS = 40;

/** The row of stamp dots (empty / filled / about-to-be-filled). */
export function StampGrid({ total, filled, pending = 0, popCount = 0 }: StampGridProps) {
  const { theme } = useTheme();

  // Clamp to the row: a stacking card can be sent more stamps than it holds, and
  // the overflow is shown as a "+N" pill rather than a second wrapped card.
  const shown = Math.min(filled, total);
  const ghosts = Math.max(0, Math.min(pending, total - shown));
  const overflow = Math.max(0, filled + pending - total);
  const popFrom = shown - Math.min(popCount, shown);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
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
        // Ghost: the filled look at reduced weight, so it reads as "coming"
        // rather than as a different kind of stamp.
        dotPending: {
          backgroundColor: theme.stampFilled,
          borderColor: theme.accent,
          opacity: 0.4,
        },
        overflowPill: {
          paddingHorizontal: 8,
          height: 24,
          borderRadius: 12,
          justifyContent: "center",
          backgroundColor: theme.stampFilled,
          opacity: 0.4,
        },
        overflowText: { color: theme.primaryText, fontSize: 13, fontWeight: "700" },
      }),
    [theme]
  );

  return (
    <View style={styles.row}>
      {[...Array(total)].map((_, i) => {
        if (i < shown) {
          // A just-added stamp pops in; the ones that were already there don't.
          if (i >= popFrom) {
            return (
              <Animated.View
                key={i}
                entering={ZoomIn.delay(POP_DELAY_MS + (i - popFrom) * POP_STAGGER_MS)
                  .duration(220)
                  .easing(EASE_OUT)}
                style={[styles.dot, styles.dotFilled]}
              />
            );
          }
          return <View key={i} style={[styles.dot, styles.dotFilled]} />;
        }
        if (i < shown + ghosts) {
          // Mount-driven: raising the quantity drops the new ghosts in one after
          // another, lowering it takes them back out.
          return (
            <Animated.View
              key={i}
              entering={ZoomIn.delay((i - shown) * GHOST_STAGGER_MS)
                .duration(180)
                .easing(EASE_OUT)}
              exiting={ZoomOut.duration(120)}
              style={[styles.dot, styles.dotPending]}
            />
          );
        }
        return <View key={i} style={styles.dot} />;
      })}

      {overflow > 0 && (
        <Animated.View
          entering={ZoomIn.duration(180).easing(EASE_OUT)}
          exiting={ZoomOut.duration(120)}
          style={styles.overflowPill}
        >
          <Text style={styles.overflowText}>+{overflow}</Text>
        </Animated.View>
      )}
    </View>
  );
}
