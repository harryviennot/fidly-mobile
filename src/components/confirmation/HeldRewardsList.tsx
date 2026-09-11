import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Gift, Clock } from "phosphor-react-native";

import { useTheme } from "@/contexts/theme-context";
import { PressableScale } from "@/components/PressableScale";
import { blendColors } from "@/utils/colors";
import { expiresSoon, formatExpiry, sortBankedRewards } from "@/utils/rewardInstances";
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
}: HeldRewardsListProps) {
  const { t, i18n } = useTranslation(namespace);
  const { theme } = useTheme();
  const sorted = useMemo(() => sortBankedRewards(rewards), [rewards]);
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
      name: { fontSize: 16, fontWeight: "600", color: theme.text },
      meta: { flexDirection: "row", alignItems: "center", gap: 4 },
      metaText: { fontSize: 13, color: theme.textSecondary },
      metaUrgent: { color: URGENT_COLOR, fontWeight: "600" },
      cta: {
        backgroundColor: theme.primary,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 16,
        minWidth: 84,
        alignItems: "center",
        justifyContent: "center",
      },
      ctaText: { fontSize: 14, fontWeight: "700", color: theme.primaryText },
    });
  }, [theme]);

  if (sorted.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t("heldRewards.title")}</Text>
      {sorted.map((reward) => {
        const expiry = formatExpiry(reward);
        const urgent = expiresSoon(reward);
        const isRedeeming = redeemingId === reward.id;
        return (
          <View
            key={reward.id}
            style={[styles.row, busy && !isRedeeming && styles.rowDisabled]}
          >
            <View style={styles.icon}>
              <Gift size={22} color={theme.primaryText} weight="fill" />
            </View>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={2}>
                {reward.name}
              </Text>
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
