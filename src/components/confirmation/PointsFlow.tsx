import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Check, Confetti, Gift, PauseCircle } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { addPoints } from "@/api/points";
import { redeemReward } from "@/api/customers";
import { markScanCompleted } from "@/lib/app-rating";
import { useLocation } from "@/contexts/location-context";
import { useTheme } from "@/contexts/theme-context";
import type { Customer, ProgramReward, StampResponse } from "@/types/api";
import {
  applyKeypadInput,
  getCurrencySymbol,
  getDecimalSeparator,
  parseAmount,
  previewPoints,
} from "@/utils/money";
import { Keypad } from "@/components/Keypad";
import { ConfirmationScaffold } from "./ConfirmationScaffold";
import { StatusScreen } from "./StatusScreen";
import { CustomerHeader } from "./CustomerHeader";
import { AmountDisplay } from "./AmountDisplay";
import { AnimatedBalance } from "./AnimatedBalance";
import { PointsProgress } from "./PointsProgress";
import { RewardsMenu } from "./RewardsMenu";

interface PointsFlowProps {
  /** May be null while the fetch is in flight — the keypad renders immediately. */
  customer: Customer | null;
  loading: boolean;
  setCustomer: Dispatch<SetStateAction<Customer | null>>;
  businessId: string;
  enrollmentId: string;
  /** Active-design rate fallback for the live preview before the snapshot lands. */
  fallbackRate: number | null;
}

const valueOf = (r: StampResponse) => r.value_after ?? r.stamps;

/** Smallest reward threshold strictly above `value`, with its name. */
function nextReward(ladder: ProgramReward[], value: number): ProgramReward | null {
  return (
    [...ladder].filter((r) => r.threshold > value).sort((a, b) => a.threshold - b.threshold)[0] ??
    null
  );
}

/**
 * Points-program confirmation flow, keypad-first: the keypad is live the moment
 * the screen opens (program type comes from the cached design), while the
 * customer name + balance populate in parallel. Enter the ticket price → one tap
 * adds points; a "rewards available" chip opens the redeem picker.
 */
export function PointsFlow({
  customer,
  loading,
  setCustomer,
  businessId,
  enrollmentId,
  fallbackRate,
}: PointsFlowProps) {
  const { t } = useTranslation("points");
  const { t: tStamp } = useTranslation("stamp");
  const { t: tCommon } = useTranslation("common");
  const { t: tLocation } = useTranslation("location");
  const { selectedLocation } = useLocation();
  const { theme } = useTheme();

  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPausedError, setIsPausedError] = useState(false);
  const [addResult, setAddResult] = useState<StampResponse | null>(null);
  const [redeemResult, setRedeemResult] = useState<StampResponse | null>(null);
  const [balanceBeforeAdd, setBalanceBeforeAdd] = useState(0);
  const [balanceBeforeRedeem, setBalanceBeforeRedeem] = useState(0);
  const [rewardsMenuOpen, setRewardsMenuOpen] = useState(false);

  const program = customer?.program ?? null;
  const ladder = program?.rewards ?? [];
  const rate = program?.points_per_currency_unit ?? fallbackRate ?? null;
  const separator = getDecimalSeparator();
  const currency = getCurrencySymbol();

  const parsedAmount = parseAmount(amount, separator);
  const pointsPreview = rate != null ? previewPoints(parsedAmount, rate) : null;

  // Live balance: after an action use its result, else the snapshot.
  const balance = redeemResult ? valueOf(redeemResult) : addResult ? valueOf(addResult) : program?.primary_value ?? 0;
  const affordableCount = ladder.filter((r) => r.threshold <= balance).length;
  const rewardReady = affordableCount > 0;

  function handleKey(key: string) {
    setAmount((a) => applyKeypadInput(a, key, separator));
  }

  function syncBalance(newValue: number) {
    setCustomer((prev) =>
      prev && prev.program
        ? { ...prev, stamps: newValue, program: { ...prev.program, primary_value: newValue } }
        : prev
    );
  }

  function mapActionError(err: unknown, fallbackKey: "errors.addFailed" | "errors.redeemFailed") {
    const code = (err as any)?.code;
    if (code === "MEMBER_PAUSED") {
      setIsPausedError(true);
    } else if (code === "CHECKOUT_REQUIRED") {
      setError(tStamp("errors.checkoutRequired"));
    } else if (code === "AMOUNT_REQUIRED") {
      setError(t("errors.amountRequired"));
    } else if (code === "LOCATION_NOT_PERMITTED") {
      setError(tLocation("errors.notPermitted"));
    } else if (code === "LOCATION_REQUIRED" || code === "LOCATION_NOT_FOUND") {
      setError(tLocation("errors.locationRequired"));
    } else {
      setError(err instanceof Error && err.message ? err.message : t(fallbackKey));
    }
  }

  async function handleAdd() {
    if (adding || !(parsedAmount > 0)) return;
    try {
      setAdding(true);
      setError(null);
      setBalanceBeforeAdd(program?.primary_value ?? 0);
      const result = await addPoints(businessId, enrollmentId, parsedAmount, selectedLocation?.id);
      const after = valueOf(result);
      setAddResult(result);
      syncBalance(after);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // A heavier second tap when this scan unlocked a reward.
      const crossed = ladder.some(
        (r) => (program?.primary_value ?? 0) < r.threshold && r.threshold <= after
      );
      if (crossed) {
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }, 130);
      }
      markScanCompleted();
    } catch (err) {
      mapActionError(err, "errors.addFailed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAdding(false);
    }
  }

  async function handleRedeem(rewardId: string) {
    if (redeemingRewardId) return;
    try {
      setRedeemingRewardId(rewardId);
      setError(null);
      setBalanceBeforeRedeem(balance);
      const result = await redeemReward(businessId, enrollmentId, selectedLocation?.id, rewardId);
      setRedeemResult(result);
      setRewardsMenuOpen(false);
      syncBalance(valueOf(result));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setRewardsMenuOpen(false);
      mapActionError(err, "errors.redeemFailed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRedeemingRewardId(null);
    }
  }

  function handleDone() {
    router.back();
  }
  function handleGoHome() {
    router.replace("/lobby");
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, width: "100%" },
        topGroup: { gap: 12 },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 9999,
          backgroundColor: theme.stampEmpty,
        },
        chipText: { color: theme.text, fontSize: 14, fontWeight: "600" },
        middle: { flex: 1, justifyContent: "center" },
        bottomGroup: { gap: 12 },
        addButton: {
          backgroundColor: theme.primary,
          paddingVertical: 18,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
        },
        addButtonDisabled: { opacity: 0.4 },
        addButtonText: { color: theme.primaryText, fontSize: 20, fontWeight: "bold" },
        cancelButton: { padding: 12, alignItems: "center" },
        cancelText: { color: theme.textSecondary, fontSize: 16 },
        // Success states
        successIcon: {
          width: 100,
          height: 100,
          borderRadius: 50,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 24,
        },
        successBody: { width: "100%", alignItems: "center" },
        successTitle: { fontSize: 28, fontWeight: "bold", color: theme.text, marginBottom: 8, textAlign: "center" },
        balanceRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
        balanceBig: { fontSize: 44, fontWeight: "800", color: theme.text, lineHeight: 48 },
        balanceUnit: { fontSize: 22, fontWeight: "700", color: theme.textSecondary, marginLeft: 6, marginBottom: 4 },
        inlineError: {
          backgroundColor: "#fef2f2",
          padding: 12,
          borderRadius: 8,
          marginTop: 16,
          width: "100%",
        },
        inlineErrorText: { color: "#dc2626", textAlign: "center" },
        primaryButton: {
          backgroundColor: theme.primary,
          paddingVertical: 16,
          paddingHorizontal: 32,
          borderRadius: 9999,
          marginTop: 24,
          alignItems: "center",
          minWidth: 200,
        },
        primaryButtonText: { color: theme.primaryText, fontSize: 18, fontWeight: "700" },
        redeemNowButton: {
          flexDirection: "row",
          gap: 10,
          backgroundColor: "#22c55e",
          paddingVertical: 16,
          paddingHorizontal: 32,
          borderRadius: 9999,
          marginTop: 24,
          alignItems: "center",
          justifyContent: "center",
          minWidth: 200,
        },
        redeemNowText: { color: "#fff", fontSize: 18, fontWeight: "700" },
        skipButton: { marginTop: 12, padding: 12, alignItems: "center" },
      }),
    [theme]
  );

  // Paused membership — shared status screen (stamp copy is scanning-generic).
  if (isPausedError) {
    return (
      <StatusScreen
        icon={<PauseCircle size={48} color="#fff" weight="fill" />}
        iconColor="#D97706"
        title={tStamp("errors.pausedTitle")}
        message={tStamp("errors.pausedMessage")}
        primary={{ label: tStamp("errors.goHome"), onPress: handleGoHome }}
      />
    );
  }

  // Redeem success: reward claimed, balance spent down.
  if (redeemResult) {
    const after = valueOf(redeemResult);
    const next = nextReward(ladder, after);
    return (
      <ConfirmationScaffold>
        <Animated.View
          entering={ZoomIn.springify().damping(13)}
          style={[styles.successIcon, { backgroundColor: "#22c55e" }]}
        >
          <Confetti size={56} color="#fff" weight="fill" />
        </Animated.View>
        <Animated.View entering={FadeIn.duration(220)} style={styles.successBody}>
          <Text style={styles.successTitle}>{t("redeem.title")}</Text>
          <View style={styles.balanceRow}>
            <AnimatedBalance from={balanceBeforeRedeem} to={after} style={styles.balanceBig} />
            <Text style={styles.balanceUnit}>{t("unit")}</Text>
          </View>
          {ladder.length > 0 && (
            <PointsProgress value={after} nextThreshold={next?.threshold ?? null} nextRewardName={next?.name} />
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
            <Text style={styles.primaryButtonText}>{t("success.scanNext")}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ConfirmationScaffold>
    );
  }

  // Add success: points credited.
  if (addResult) {
    const after = valueOf(addResult);
    const justCrossed = ladder.some((r) => balanceBeforeAdd < r.threshold && r.threshold <= after);
    const canRedeem = ladder.some((r) => r.threshold <= after);
    const next = nextReward(ladder, after);
    return (
      <ConfirmationScaffold>
        <Animated.View
          entering={ZoomIn.springify().damping(13)}
          style={[styles.successIcon, { backgroundColor: justCrossed ? "#f59e0b" : "#22c55e" }]}
        >
          {justCrossed ? (
            <Confetti size={56} color="#fff" weight="fill" />
          ) : (
            <Check size={56} color="#fff" weight="bold" />
          )}
        </Animated.View>
        <Animated.View entering={FadeIn.duration(220)} style={styles.successBody}>
          <Text style={styles.successTitle}>
            {justCrossed ? t("reward.unlocked") : t("success.title")}
          </Text>
          <View style={styles.balanceRow}>
            <AnimatedBalance from={balanceBeforeAdd} to={after} style={styles.balanceBig} />
            <Text style={styles.balanceUnit}>{t("unit")}</Text>
          </View>
          {ladder.length > 0 && (
            <PointsProgress value={after} nextThreshold={next?.threshold ?? null} nextRewardName={next?.name} />
          )}

          {canRedeem ? (
            <TouchableOpacity style={styles.redeemNowButton} onPress={() => setRewardsMenuOpen(true)}>
              <Gift size={22} color="#fff" weight="bold" />
              <Text style={styles.redeemNowText}>{t("reward.redeemNow")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
              <Text style={styles.primaryButtonText}>{t("success.scanNext")}</Text>
            </TouchableOpacity>
          )}
          {canRedeem && (
            <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
              <Text style={styles.cancelText}>{t("success.scanNext")}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <RewardsMenu
          visible={rewardsMenuOpen}
          onClose={() => setRewardsMenuOpen(false)}
          rewards={ladder}
          balance={after}
          onRedeem={handleRedeem}
          redeemingRewardId={redeemingRewardId}
        />
      </ConfirmationScaffold>
    );
  }

  // Entry: keypad-first.
  const balanceLabel = program ? t("balance", { count: program.primary_value }) : null;

  return (
    <ConfirmationScaffold>
      <View style={styles.root}>
        <View style={styles.topGroup}>
          <CustomerHeader name={customer?.name ?? null} balance={balanceLabel} loading={loading} />
          {rewardReady && (
            <TouchableOpacity style={styles.chip} onPress={() => setRewardsMenuOpen(true)} activeOpacity={0.7}>
              <Gift size={16} color={theme.primary} weight="fill" />
              <Text style={styles.chipText}>
                {t(affordableCount === 1 ? "rewardsAvailable_one" : "rewardsAvailable", {
                  count: affordableCount,
                })}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.middle}>
          <AmountDisplay amount={amount} currencySymbol={currency} pointsPreview={pointsPreview} />
          {error && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomGroup}>
          <Keypad onKeyPress={handleKey} separator={separator} disabled={adding} />
          <TouchableOpacity
            style={[styles.addButton, !(parsedAmount > 0) && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={adding || !(parsedAmount > 0)}
            activeOpacity={0.85}
          >
            {adding ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <Text style={styles.addButtonText}>{t("addPoints")}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
            <Text style={styles.cancelText}>{tCommon("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <RewardsMenu
        visible={rewardsMenuOpen}
        onClose={() => setRewardsMenuOpen(false)}
        rewards={ladder}
        balance={balance}
        onRedeem={handleRedeem}
        redeemingRewardId={redeemingRewardId}
      />
    </ConfirmationScaffold>
  );
}
