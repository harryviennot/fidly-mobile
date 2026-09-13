import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Gift, Clock } from "phosphor-react-native";

import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "@/components/PressableScale";
import { blendColors } from "@/utils/colors";
import {
  expiresSoon,
  formatExpiry,
  groupBankedRewards,
  sortBankedRewards,
} from "@/utils/rewardInstances";
import { selectPluralForm } from "@/utils/plural";
import type { BankedReward } from "@/types/api";

// The scanner theme is derived from the merchant's brand and carries no danger
// colour. An expiry warning must read as urgent regardless of that brand, so
// this one is fixed — a burnt orange that stays legible on every pale surface
// the theme generates.
const URGENT_COLOR = "rgb(194, 65, 12)";

interface HeldRewardsListProps {
  rewards: BankedReward[];
  /** Redeem one specific instance by its customer_rewards row id. */
  onRedeem: (reward: BankedReward) => void;
  /** The instance id currently redeeming (shows a spinner), or null. */
  redeemingId: string | null;
  /** Namespace to read strings from — both stamp and points carry the block. */
  namespace?: "stamp" | "points";
  /**
   * Which string to head the list with. Inside the rewards menu the sheet
   * already says "Rewards", so the list names the GROUP instead ("Already
   * earned") rather than repeating it or going unlabelled.
   */
  titleKey?: string;
}

/**
 * The rewards this customer already HOLDS, listed one per row so the employee
 * hands over the right thing.
 *
 * Unlike the points menu, nothing here is affordability-gated: these are
 * already earned or already given, so every row is claimable whatever the
 * balance says. On a points program this sits ABOVE the priced menu for the
 * same reason — "what they have" comes before "what they could buy".
 *
 * Ordered soonest-expiring first, matching the server's drain order, so the
 * top row is the one the backend would pick anyway.
 */
export function HeldRewardsList({
  rewards,
  onRedeem,
  redeemingId,
  namespace = "stamp",
  titleKey = "heldRewards.title",
}: HeldRewardsListProps) {
  const { t, i18n } = useTranslation(namespace);
  const { theme } = useTheme();
  // Sorted into drain order, then collapsed: six of the same reward is one
  // fact, and six rows of it pushed the stamp buttons off the screen. The
  // dashboard already groups; the counter should not disagree with it.
  const groups = useMemo(
    () => groupBankedRewards(sortBankedRewards(rewards)),
    [rewards]
  );
  const busy = redeemingId != null;

  const styles = useMemo(() => {
    const rowBg = blendColors(theme.primary, theme.background, 0.9);
    return StyleSheet.create({
      section: { gap: 10 },
      title: {
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: theme.textSecondary,
      },
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: rowBg,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
      },
      rowDisabled: { opacity: 0.5 },
      icon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.primary,
      },
      // Fills the row so the expiry line sits under the name rather than
      // beside it; a long reward name must wrap, not push the CTA off-screen.
      body: { flex: 1, gap: 2 },
      name: { fontSize: 16, fontWeight: "600", color: theme.text, flexShrink: 1 },
      meta: { flexDirection: "row", alignItems: "center", gap: 4 },
      metaText: { fontSize: 13, color: theme.textSecondary },
      metaUrgent: { color: URGENT_COLOR, fontWeight: "600" },
      cta: {
        backgroundColor: theme.primary,
        borderRadius: 999,
        paddingVertical: 12,
        paddingHorizontal: 16,
        minWidth: 84,
        // 44pt is the smallest comfortable touch target, and this is pressed
        // with one hand across a counter.
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
      },
      ctaText: { fontSize: 14, fontWeight: "700", color: theme.primaryText },
      nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
      countBadge: {
        backgroundColor: theme.primary,
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 2,
      },
      countBadgeText: {
        fontSize: 12,
        fontWeight: "800",
        color: theme.primaryText,
        fontVariant: ["tabular-nums"],
      },
    });
  }, [theme]);

  if (groups.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Same cast the plural lookup below uses: the key is chosen by the
          caller, so it cannot be checked against the literal key union. */}
      <Text style={styles.title}>{(t as (k: string) => string)(titleKey)}</Text>
      {groups.map((group) => {
        const reward = group.first;
        const expiry = formatExpiry(reward);
        const urgent = expiresSoon(reward);
        const isRedeeming = redeemingId === reward.id;
        return (
          <View
            key={group.key}
            style={[styles.row, busy && !isRedeeming && styles.rowDisabled]}
          >
            <View style={styles.icon}>
              <Gift size={22} color={theme.primaryText} weight="fill" />
            </View>
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={2}>
                  {reward.name}
                </Text>
                {group.count > 1 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{`\u00d7${group.count}`}</Text>
                  </View>
                )}
              </View>
              {expiry && (
                <View style={styles.meta}>
                  <Clock
                    size={13}
                    color={urgent ? styles.metaUrgent.color : styles.metaText.color}
                    weight={urgent ? "fill" : "regular"}
                  />
                  <Text style={[styles.metaText, urgent && styles.metaUrgent]}>
                    {expiry.key === "today"
                      ? t("heldRewards.expiresToday")
                      : expiry.key === "expired"
                        ? t("heldRewards.expired")
                        : (t as (k: string, o?: object) => string)(
                            `heldRewards.expiresIn_${selectPluralForm(i18n.language, expiry.days)}`,
                            { count: expiry.days }
                          )}
                  </Text>
                </View>
              )}
            </View>
            <PressableScale
              style={styles.cta}
              haptic="medium"
              onPress={() => onRedeem(reward)}
              disabled={busy}
            >
              {isRedeeming ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <Text style={styles.ctaText}>{t("heldRewards.redeem")}</Text>
              )}
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}
