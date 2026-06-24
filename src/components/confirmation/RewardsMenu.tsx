import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Gift, LockSimple } from "phosphor-react-native";
import { useTheme } from "@/contexts/theme-context";
import { BottomSheet } from "@/components/BottomSheet";
import type { ProgramReward } from "@/types/api";

interface RewardsMenuProps {
  visible: boolean;
  onClose: () => void;
  rewards: ProgramReward[];
  /** Live balance — affordability is computed from this, not the stale `reached`. */
  balance: number;
  onRedeem: (rewardId: string) => void;
  /** The reward id currently being redeemed (shows a spinner), or null. */
  redeemingRewardId: string | null;
}

/**
 * The points redeem picker: a bottom sheet listing the reward ladder. Affordable
 * rewards (price ≤ current balance) are tappable; the rest are locked with a
 * "N pts to go" hint. Tapping an affordable reward redeems it (spend-down).
 */
export function RewardsMenu({
  visible,
  onClose,
  rewards,
  balance,
  onRedeem,
  redeemingRewardId,
}: RewardsMenuProps) {
  const { t } = useTranslation("points");
  const { theme } = useTheme();
  const sorted = useMemo(
    () => [...rewards].sort((a, b) => a.threshold - b.threshold),
    [rewards]
  );
  const busy = redeemingRewardId != null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingBottom: 32,
          maxHeight: "80%",
        },
        title: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 4 },
        balance: { fontSize: 14, color: theme.textSecondary, marginBottom: 16 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 14,
          marginBottom: 8,
          backgroundColor: theme.background,
        },
        rowLocked: { opacity: 0.55 },
        iconWrap: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.stampEmpty,
        },
        iconWrapReady: { backgroundColor: theme.primary },
        info: { flex: 1, gap: 2 },
        name: { fontSize: 16, fontWeight: "600", color: theme.text },
        cost: { fontSize: 13, color: theme.textSecondary },
        redeemPill: {
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 9999,
          backgroundColor: theme.primary,
          minWidth: 84,
          alignItems: "center",
        },
        redeemText: { color: theme.primaryText, fontWeight: "700", fontSize: 14 },
      }),
    [theme]
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <Text style={styles.title}>{t("menu.title")}</Text>
      <Text style={styles.balance}>{t("balance", { count: balance })}</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {sorted.map((reward) => {
          const affordable = balance >= reward.threshold;
          const isRedeeming = redeemingRewardId === reward.id;
          return (
            <TouchableOpacity
              key={reward.id}
              style={[styles.row, !affordable && styles.rowLocked]}
              disabled={!affordable || busy}
              activeOpacity={0.7}
              onPress={() => onRedeem(reward.id)}
            >
              <View style={[styles.iconWrap, affordable && styles.iconWrapReady]}>
                {affordable ? (
                  <Gift size={20} color={theme.primaryText} weight="fill" />
                ) : (
                  <LockSimple size={18} color={theme.textSecondary} weight="bold" />
                )}
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {reward.name}
                </Text>
                <Text style={styles.cost}>
                  {affordable
                    ? t("menu.cost", { count: reward.threshold })
                    : t("menu.need", { count: reward.threshold - balance })}
                </Text>
              </View>
              {affordable && (
                <View style={styles.redeemPill}>
                  {isRedeeming ? (
                    <ActivityIndicator color={theme.primaryText} size="small" />
                  ) : (
                    <Text style={styles.redeemText}>{t("menu.redeem")}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
