import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { CaretRight, Check, Confetti, Gift, PauseCircle } from "phosphor-react-native";
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
import { PressableScale } from "@/components/PressableScale";
import { ConfirmationScaffold } from "./ConfirmationScaffold";
import { StatusScreen } from "./StatusScreen";
import { CustomerHeader } from "./CustomerHeader";
import { AmountDisplay } from "./AmountDisplay";
import { AnimatedBalance } from "./AnimatedBalance";
import { PointsProgress } from "./PointsProgress";
import { RewardsMenu } from "./RewardsMenu";
import { ACTION_ENTER, BODY_ENTER, DETAIL_ENTER, ICON_ENTER, SOFT_ENTER } from "./animations";

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

// Success palette: soft tinted circles with a colored glyph instead of solid
// saturated discs — the screen shows up dozens of times a day, so the only
// fully saturated element is the action button.
const SUCCESS_GREEN = "#16a34a";
const SUCCESS_TINT = "rgba(34, 197, 94, 0.14)";
const UNLOCK_AMBER = "#d97706";
const UNLOCK_TINT = "rgba(245, 158, 11, 0.16)";

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
  const [redeemedRewardName, setRedeemedRewardName] = useState<string | null>(null);
  const [rewardsMenuOpen, setRewardsMenuOpen] = useState(false);

  const program = customer?.program ?? null;
  const ladder = useMemo(() => program?.rewards ?? [], [program]);
  const rate = program?.points_per_currency_unit ?? fallbackRate ?? null;
  const separator = getDecimalSeparator();
  const currency = getCurrencySymbol();

  const parsedAmount = parseAmount(amount, separator);
  const pointsPreview = rate != null ? previewPoints(parsedAmount, rate) : null;

  // Live balance: after an action use its result, else the snapshot.
  const balance = redeemResult ? valueOf(redeemResult) : addResult ? valueOf(addResult) : program?.primary_value ?? 0;
  const affordableCount = ladder.filter((r) => r.threshold <= balance).length;
  const rewardReady = affordableCount > 0;

  // The add CTA fades between enabled/disabled instead of jumping. Gated on
  // the customer snapshot having arrived: the keypad opens optimistically from
  // the cached design type, and if the program was converted underneath the
  // cache the dispatcher reroutes on load — submitting before that would let a
  // ticket price silently land as +1 stamp on a now-stamp program.
  const canAdd = parsedAmount > 0 && !loading;
  const addOpacity = useSharedValue(canAdd ? 1 : 0.4);
  useEffect(() => {
    addOpacity.value = withTiming(canAdd ? 1 : 0.4, { duration: 160 });
  }, [canAdd, addOpacity]);
  const addOpacityStyle = useAnimatedStyle(() => ({ opacity: addOpacity.value }));

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
    } else if (code === "BILLING_REQUIRED") {
      setError(tStamp("errors.billingRequired"));
    } else if (code === "ACCESS_DENIED") {
      setError(tStamp("errors.accessDenied"));
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
      setRedeemedRewardName(ladder.find((r) => r.id === rewardId)?.name ?? null);
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
        // Solid filled pill so it reads as a tappable button and stays legible
        // for ANY brand color. The previous pale-tint-on-tint version vanished
        // for light `primary` palettes (text color == background). primaryText is
        // the design's guaranteed-contrast foreground on primary.
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 11,
          paddingHorizontal: 16,
          borderRadius: 9999,
          backgroundColor: theme.primary,
        },
        chipWrap: { alignSelf: "flex-start" },
        chipText: { color: theme.primaryText, fontSize: 15, fontWeight: "700" },
        middle: { flex: 1, justifyContent: "center" },
        bottomGroup: { gap: 12 },
        addButton: {
          backgroundColor: theme.primary,
          paddingVertical: 18,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
        },
        addButtonText: { color: theme.primaryText, fontSize: 20, fontWeight: "bold" },
        cancelButton: { padding: 12, alignItems: "center" },
        cancelText: { color: theme.textSecondary, fontSize: 16 },
        // Success states — full-height: header on top, balance hero centered in
        // the remaining space, actions anchored at the bottom (where the thumb
        // already is after tapping "Add points").
        successRoot: { flex: 1, width: "100%", alignItems: "center" },
        successHeader: { alignItems: "center", paddingTop: 8 },
        successHeaderText: { alignItems: "center" },
        successIcon: {
          width: 72,
          height: 72,
          borderRadius: 36,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        },
        successTitle: { fontSize: 24, fontWeight: "700", color: theme.text, marginBottom: 4, textAlign: "center" },
        successName: { fontSize: 15, color: theme.textSecondary, textAlign: "center" },
        successHero: {
          flex: 1,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        },
        earnedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        earnedText: { color: SUCCESS_GREEN, fontSize: 17, fontWeight: "600" },
        balanceRow: { flexDirection: "row", alignItems: "flex-end" },
        balanceBig: { fontSize: 62, fontWeight: "700", color: theme.text, lineHeight: 66 },
        balanceUnit: { fontSize: 24, fontWeight: "600", color: theme.textSecondary, marginLeft: 7, marginBottom: 8 },
        successActions: { width: "100%", gap: 2 },
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
          paddingVertical: 18,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        },
        primaryButtonText: { color: theme.primaryText, fontSize: 20, fontWeight: "bold" },
        redeemNowButton: {
          flexDirection: "row",
          gap: 10,
          backgroundColor: "#22c55e",
          paddingVertical: 18,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        },
        redeemNowText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
        skipButton: { padding: 14, alignItems: "center" },
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

  // Redeem success: reward claimed, balance spent down. Full-height layout:
  // what happened on top, the new balance as the hero, actions at the bottom.
  if (redeemResult) {
    const after = valueOf(redeemResult);
    const next = nextReward(ladder, after);
    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[styles.successIcon, { backgroundColor: SUCCESS_TINT }]}
            >
              <Confetti size={36} color={SUCCESS_GREEN} weight="fill" />
            </Animated.View>
            <Animated.View entering={BODY_ENTER} style={styles.successHeaderText}>
              <Text style={styles.successTitle}>{t("redeem.title")}</Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer?.name ?? ""}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {redeemedRewardName && (
              <View style={styles.earnedRow}>
                <Gift size={16} color={SUCCESS_GREEN} weight="fill" />
                <Text style={styles.earnedText} numberOfLines={1}>
                  {redeemedRewardName}
                </Text>
              </View>
            )}
            <View style={styles.balanceRow}>
              <AnimatedBalance from={balanceBeforeRedeem} to={after} style={styles.balanceBig} />
              <Text style={styles.balanceUnit}>{t("unit")}</Text>
            </View>
            {ladder.length > 0 && (
              <PointsProgress
                value={after}
                nextThreshold={next?.threshold ?? null}
                nextRewardName={next?.name}
              />
            )}
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            <PressableScale style={styles.primaryButton} onPress={handleDone}>
              <Text style={styles.primaryButtonText}>{t("success.scanNext")}</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Add success: points credited.
  if (addResult) {
    const after = valueOf(addResult);
    const earned = Math.max(0, after - balanceBeforeAdd);
    const justCrossed = ladder.some((r) => balanceBeforeAdd < r.threshold && r.threshold <= after);
    const canRedeem = ladder.some((r) => r.threshold <= after);
    const next = nextReward(ladder, after);
    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[styles.successIcon, { backgroundColor: justCrossed ? UNLOCK_TINT : SUCCESS_TINT }]}
            >
              {justCrossed ? (
                <Confetti size={36} color={UNLOCK_AMBER} weight="fill" />
              ) : (
                <Check size={36} color={SUCCESS_GREEN} weight="bold" />
              )}
            </Animated.View>
            <Animated.View entering={BODY_ENTER} style={styles.successHeaderText}>
              <Text style={styles.successTitle}>
                {justCrossed ? t("reward.unlocked") : t("success.title")}
              </Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer?.name ?? ""}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {earned > 0 && (
              <Text style={styles.earnedText}>{t("success.earned", { count: earned })}</Text>
            )}
            <View style={styles.balanceRow}>
              <AnimatedBalance from={balanceBeforeAdd} to={after} style={styles.balanceBig} />
              <Text style={styles.balanceUnit}>{t("unit")}</Text>
            </View>
            {ladder.length > 0 && (
              <PointsProgress
                value={after}
                nextThreshold={next?.threshold ?? null}
                nextRewardName={next?.name}
                previousValue={balanceBeforeAdd}
              />
            )}
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            {canRedeem ? (
              <PressableScale
                style={styles.redeemNowButton}
                haptic="medium"
                onPress={() => setRewardsMenuOpen(true)}
              >
                <Gift size={22} color="#fff" weight="bold" />
                <Text style={styles.redeemNowText}>{t("reward.redeemNow")}</Text>
              </PressableScale>
            ) : (
              <PressableScale style={styles.primaryButton} onPress={handleDone}>
                <Text style={styles.primaryButtonText}>{t("success.scanNext")}</Text>
              </PressableScale>
            )}
            {canRedeem && (
              <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
                <Text style={styles.cancelText}>{t("success.scanNext")}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

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

  // Entry: keypad-first. The header line packs the glanceable facts: balance
  // plus how far the next reward is, so the employee can say it out loud.
  const entryNext = program ? nextReward(ladder, program.primary_value) : null;
  const balanceLabel = program
    ? entryNext
      ? `${t("balance", { count: program.primary_value })} · ${t("success.toNextReward", {
          count: entryNext.threshold - program.primary_value,
          reward: entryNext.name,
        })}`
      : t("balance", { count: program.primary_value })
    : null;

  return (
    <ConfirmationScaffold>
      <View style={styles.root}>
        <View style={styles.topGroup}>
          <CustomerHeader name={customer?.name ?? null} balance={balanceLabel} loading={loading} />
          {rewardReady && (
            <Animated.View entering={SOFT_ENTER} style={styles.chipWrap}>
              <PressableScale
                style={styles.chip}
                scaleTo={0.95}
                onPress={() => setRewardsMenuOpen(true)}
              >
                <Gift size={18} color={theme.primaryText} weight="fill" />
                <Text style={styles.chipText}>
                  {t(affordableCount === 1 ? "rewardsAvailable_one" : "rewardsAvailable", {
                    count: affordableCount,
                  })}
                </Text>
                <CaretRight size={16} color={theme.primaryText} weight="bold" />
              </PressableScale>
            </Animated.View>
          )}
        </View>

        <View style={styles.middle}>
          <AmountDisplay amount={amount} currencySymbol={currency} pointsPreview={pointsPreview} />
          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.bottomGroup}>
          <Keypad onKeyPress={handleKey} separator={separator} disabled={adding} />
          <Animated.View style={addOpacityStyle}>
            <PressableScale
              style={styles.addButton}
              haptic="medium"
              onPress={handleAdd}
              disabled={adding || !canAdd}
            >
              {adding ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <Text style={styles.addButtonText}>{t("addPoints")}</Text>
              )}
            </PressableScale>
          </Animated.View>
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
