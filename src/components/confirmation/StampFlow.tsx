import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Confetti, Check, Gift, PauseCircle } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { addStamp, redeemReward } from "@/api/customers";
import { markScanCompleted } from "@/lib/app-rating";
import { useLocation } from "@/contexts/location-context";
import { useTheme } from "@/contexts/theme-context";
import { clampStampQuantity, maxStampQuantity } from "@/utils/stamps";
import { resolveWaiveAction } from "@/utils/cap";
import { selectPluralForm } from "@/utils/plural";
import type { Customer, StampResponse } from "@/types/api";
import { PressableScale } from "@/components/PressableScale";
import { ConfirmationScaffold } from "./ConfirmationScaffold";
import { StatusScreen } from "./StatusScreen";
import { StampGrid } from "./StampGrid";
import { StampStepper } from "./StampStepper";
import { CapBlockedScreen } from "./CapBlockedScreen";
import { CustomerHeader } from "./CustomerHeader";
import { AnimatedBalance } from "./AnimatedBalance";
import { ACTION_ENTER, BODY_ENTER, DETAIL_ENTER, ICON_ENTER, SOFT_ENTER } from "./animations";
import { SUCCESS_GREEN, SUCCESS_TINT, UNLOCK_AMBER, UNLOCK_TINT } from "./palette";

interface StampFlowProps {
  customer: Customer;
  setCustomer: Dispatch<SetStateAction<Customer | null>>;
  businessId: string;
  enrollmentId: string;
}

/**
 * Stamp-program confirmation flow.
 *
 * One scan can be worth several stamps: the stepper sets the quantity, the card
 * previews it as ghost dots, and a single request credits the lot (one
 * transaction, one wallet push, one banner for the customer) instead of the
 * employee pressing the button five times.
 *
 * Laid out like the points keypad screen: facts on top, the card in the middle,
 * the controls anchored at the bottom where the thumb already is.
 */
export function StampFlow({ customer, setCustomer, businessId, enrollmentId }: StampFlowProps) {
  const { t, i18n } = useTranslation("stamp");
  const { t: tCommon } = useTranslation("common");
  const { t: tLocation } = useTranslation("location");
  const { selectedLocation } = useLocation();
  const { theme, design, refreshTheme } = useTheme();

  const [stamping, setStamping] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPausedError, setIsPausedError] = useState(false);
  const [success, setSuccess] = useState<StampResponse | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  // Card state before the last stamp — detects a rollover (stackable rewards:
  // stamps reset below the goal but a reward was banked) and drives the
  // count-up + the stagger on the dots that were just added.
  const [preStampRewards, setPreStampRewards] = useState(0);
  const [preStampStamps, setPreStampStamps] = useState(0);
  // Manager decided to push this customer past their earning limit. Lives for
  // one scan; the request carries it and the server re-checks the role.
  const [capOverride, setCapOverride] = useState(false);
  // Cap standing the LAST request reported, when it beat the snapshot (another
  // device scanned this customer while this screen was open).
  const [capError, setCapError] = useState<{
    scope: "day" | "week";
    limit: number;
    resets_at: string;
    can_override?: boolean;
  } | null>(null);

  // Program config is the source of truth for the goal; the design column
  // is a deprecated synced copy kept as fallback.
  const totalStamps = customer.total_stamps ?? design?.total_stamps ?? 10;
  const stackable = customer.stackable_rewards ?? false;
  const maxStack = customer.max_stacked_rewards ?? null;
  const rewards = customer.rewards ?? 0;
  const currentStamps = customer.stamps || 0;
  const cardFull = currentStamps >= totalStamps;
  // Blocked at the stack cap: behaves exactly like the classic full card.
  const atMaxStack = stackable && maxStack != null && rewards >= maxStack && cardFull;
  // Classic redeem-or-skip screen: non-stackable full card, or capped stack.
  const isReadyForReward = cardFull && (!stackable || atMaxStack);
  // Stackable flow: stamping continues, banked rewards redeemable anytime.
  const hasBankedRewards = stackable && rewards > 0 && !isReadyForReward;

  // How many stamps this scan is worth. Capped at what the card can absorb, so
  // the stepper never promises stamps the server would drop.
  const [quantity, setQuantity] = useState(1);
  const earningCap = customer.program?.earning_cap ?? null;
  const maxQuantity = useMemo(
    () =>
      maxStampQuantity({
        totalStamps,
        currentStamps,
        stackable,
        // An override lifts the cap for this scan, so the stepper goes back to
        // what the card can hold.
        capRemaining: capOverride ? null : earningCap?.remaining ?? null,
      }),
    [totalStamps, currentStamps, stackable, earningCap?.remaining, capOverride]
  );
  // The ceiling moves when the customer snapshot refreshes (a concurrent scan on
  // another device); pull the quantity back in rather than sending a stale one.
  useEffect(() => {
    setQuantity((q) => clampStampQuantity(q, maxQuantity));
  }, [maxQuantity]);

  const willCompleteCard = currentStamps + quantity >= totalStamps;

  // Explicit plural key selection: we know the count, so never show a "(s)"
  // guess. (The form is picked in JS rather than by i18next, whose resolver is
  // built on Intl.PluralRules and unreliable on Hermes. Polish needs one/few/
  // many, so a "1 or not 1" ternary is not enough.)
  const plural = (count: number) => selectPluralForm(i18n.language, count);

  const rewardsWaitingText = (count: number) =>
    t(`success.rewardsWaiting_${plural(count)}`, { count });

  /**
   * The payoff. A success notification, then one light tick per stamp so a
   * 5-stamp scan is *felt* as five, capped so a big batch doesn't buzz forever.
   * A heavier tap lands last when the scan earned a reward.
   */
  async function celebrate(stampsAdded: number, earnedReward: boolean) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const ticks = Math.min(stampsAdded, 5);
    for (let i = 1; i < ticks; i++) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, i * 55);
    }
    if (earnedReward) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, ticks * 55 + 80);
    }
  }

  /**
   * `overrideNow` is the manager's just-made decision, passed explicitly because
   * the `capOverride` state it also sets is not readable until the next render.
   */
  async function handleAddStamp(overrideNow?: boolean) {
    if (stamping) return;
    try {
      setStamping(true);
      setError(null);
      setPreStampRewards(rewards);
      setPreStampStamps(currentStamps);
      const result = await addStamp(
        businessId,
        enrollmentId,
        selectedLocation?.id,
        quantity,
        overrideNow ?? capOverride
      );
      setSuccess(result);
      setCustomer((prev) =>
        prev ? { ...prev, stamps: result.stamps, rewards: result.rewards ?? prev.rewards } : null
      );
      const added = result.delta ?? Math.max(0, result.stamps - currentStamps);
      const earned = result.stamps >= totalStamps || (result.rewards ?? 0) > rewards;
      await celebrate(added, earned);
      // Arm the one-time rating prompt. It is NOT shown here — it fires when the
      // employee next returns to the lobby, so it never interrupts scanning.
      markScanCompleted();
    } catch (err) {
      const code = (err as any)?.code;
      if (code === "MEMBER_PAUSED") {
        setIsPausedError(true);
      } else if (code === "EARNING_CAP_REACHED") {
        // The snapshot said there was room, but another device used it first.
        // Show the same blocked screen rather than a bare error line.
        const detail = (err as any)?.detail ?? {};
        setCapError({
          scope: detail.scope === "week" ? "week" : "day",
          limit: detail.limit ?? 0,
          resets_at: detail.resets_at ?? "",
          can_override: detail.can_override ?? false,
        });
      } else if (code === "CAP_OVERRIDE_NOT_ALLOWED") {
        setCapOverride(false);
        setError(t("cap.overrideNotAllowed"));
      } else if (code === "CHECKOUT_REQUIRED") {
        setError(t("errors.checkoutRequired"));
      } else if (code === "BILLING_REQUIRED") {
        setError(t("errors.billingRequired"));
      } else if (code === "ACCESS_DENIED") {
        setError(t("errors.accessDenied"));
      } else if (code === "LOCATION_NOT_PERMITTED") {
        setError(tLocation("errors.notPermitted"));
      } else if (code === "LOCATION_REQUIRED" || code === "LOCATION_NOT_FOUND") {
        setError(tLocation("errors.locationRequired"));
      } else if (code === "AMOUNT_REQUIRED") {
        // The program converted to points between our customer fetch and this
        // tap. Explain, and force-refresh the cached design so the next scan
        // opens the points keypad directly.
        setError(t("errors.programNowPoints"));
        refreshTheme(true);
      } else {
        setError(err instanceof Error ? err.message : t("errors.stampFailed"));
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStamping(false);
    }
  }

  /**
   * Manager waives the limit. When the block came from a rejected request the
   * quantity is still on screen and already confirmed, so send it straight
   * through rather than dropping them back on the stepper to press "Add stamp"
   * a second time on a quantity they never changed.
   */
  async function handleWaive() {
    setCapOverride(true);
    setError(null);
    const action = resolveWaiveAction({
      rejectedRequest: capError !== null,
      inputReady: quantity >= 1,
    });
    if (action === "resubmit") {
      // capError stays until this lands: it keeps the limit screen (and its
      // spinner) up instead of flashing the stepper mid-request, and a failure
      // leaves the decision exactly where the manager made it.
      await handleAddStamp(true);
      return;
    }
    setCapError(null);
  }

  async function handleRedeemReward() {
    if (redeeming) return;
    try {
      setRedeeming(true);
      setError(null);
      const result = await redeemReward(businessId, enrollmentId, selectedLocation?.id);
      // Banked redemptions keep stamp progress; only the classic full-card
      // redemption resets to 0. Trust the server's response either way.
      setCustomer((prev) =>
        prev ? { ...prev, stamps: result.stamps, rewards: result.rewards ?? 0 } : null
      );
      setRedeemSuccess(true);
      setSuccess(result);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if ((err as any)?.code === "MEMBER_PAUSED") {
        setIsPausedError(true);
      } else if ((err as any)?.code === "CHECKOUT_REQUIRED") {
        setError(t("errors.checkoutRequired"));
      } else if ((err as any)?.code === "BILLING_REQUIRED") {
        setError(t("errors.billingRequired"));
      } else if ((err as any)?.code === "ACCESS_DENIED") {
        setError(t("errors.accessDenied"));
      } else {
        setError(err instanceof Error ? err.message : t("errors.redeemFailed"));
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRedeeming(false);
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
          gap: 8,
          paddingVertical: 11,
          paddingHorizontal: 16,
          borderRadius: 9999,
          backgroundColor: "#f59e0b",
          alignSelf: "flex-start",
        },
        chipText: { color: "#fff", fontSize: 15, fontWeight: "700" },
        // The card sits in the flexible middle, vertically centered like the
        // points amount, so the controls below never move between screens.
        middle: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
        countRow: { flexDirection: "row", alignItems: "flex-end" },
        countBig: { fontSize: 56, fontWeight: "700", color: theme.text, lineHeight: 60 },
        countTotal: {
          fontSize: 22,
          fontWeight: "600",
          color: theme.textSecondary,
          marginLeft: 6,
          marginBottom: 8,
        },
        // Fixed height: the pending line appears and disappears as the quantity
        // changes and must not shove the card up and down.
        pendingRow: { height: 26, justifyContent: "center" },
        pendingText: { fontSize: 17, fontWeight: "700", color: theme.primaryOnSurface },
        completeText: { fontSize: 17, fontWeight: "700", color: UNLOCK_AMBER },
        bottomGroup: { gap: 12 },
        stampButton: {
          backgroundColor: theme.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 18,
          borderRadius: 9999,
          width: "100%",
          gap: 12,
        },
        stampButtonText: { color: theme.primaryText, fontSize: 20, fontWeight: "bold" },
        buttonDisabled: { opacity: 0.7 },
        redeemButton: {
          backgroundColor: "#22c55e",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 18,
          borderRadius: 9999,
          width: "100%",
          gap: 12,
        },
        redeemButtonText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
        cancelButton: { padding: 12, alignItems: "center" },
        cancelText: { color: theme.textSecondary, fontSize: 16 },
        skipButton: { padding: 14, alignItems: "center" },
        // A scan the earning limit truncated, and the banner saying so while
        // an override is armed. Amber, not red: nothing went wrong.
        capNote: {
          marginTop: 10,
          fontSize: 13.5,
          lineHeight: 19,
          fontWeight: "600",
          color: UNLOCK_AMBER,
          textAlign: "center",
        },
        overrideNotice: {
          marginTop: 12,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: UNLOCK_TINT,
        },
        overrideNoticeText: {
          fontSize: 13,
          fontWeight: "600",
          color: UNLOCK_AMBER,
          textAlign: "center",
        },
        inlineError: {
          backgroundColor: "#fef2f2",
          padding: 12,
          borderRadius: 8,
          width: "100%",
        },
        inlineErrorText: { color: "#dc2626", textAlign: "center" },
        // Success states: header on top, the card as the centered hero, actions
        // anchored at the bottom.
        successRoot: { flex: 1, width: "100%", alignItems: "center" },
        successHeader: { alignItems: "center", paddingTop: 8 },
        successIcon: {
          width: 72,
          height: 72,
          borderRadius: 36,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        },
        successTitle: {
          fontSize: 24,
          fontWeight: "700",
          color: theme.text,
          marginBottom: 4,
          textAlign: "center",
        },
        successName: { fontSize: 15, color: theme.textSecondary, textAlign: "center" },
        successHero: {
          flex: 1,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        },
        successNote: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
          lineHeight: 24,
        },
        successActions: { width: "100%", gap: 2 },
        rewardPrompt: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
        },
      }),
    [theme]
  );

  // Shared redeem CTA (same look everywhere; press-scale + medium haptic).
  const renderRedeemButton = (alsoDisabled = false) => (
    <PressableScale
      style={[styles.redeemButton, redeeming && styles.buttonDisabled]}
      haptic="medium"
      onPress={handleRedeemReward}
      disabled={redeeming || alsoDisabled}
    >
      {redeeming ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Gift size={24} color="#fff" weight="bold" />
          <Text style={styles.redeemButtonText}>{t("redeemReward")}</Text>
        </>
      )}
    </PressableScale>
  );

  /** The count-up counter + the card, shared by every success state. */
  const renderHeroCard = (from: number, to: number, popCount: number) => (
    <>
      <View style={styles.countRow}>
        <AnimatedBalance from={from} to={to} style={styles.countBig} />
        <Text style={styles.countTotal}>/ {totalStamps}</Text>
      </View>
      <StampGrid total={totalStamps} filled={to} popCount={popCount} />
    </>
  );

  // Paused member error — dedicated screen with Go Home action.
  if (isPausedError) {
    return (
      <StatusScreen
        icon={<PauseCircle size={48} color="#fff" weight="fill" />}
        iconColor="#D97706"
        title={t("errors.pausedTitle")}
        message={t("errors.pausedMessage")}
        primary={{ label: t("errors.goHome"), onPress: handleGoHome }}
      />
    );
  }

  // Reward redemption success. A banked redemption (stackable rewards) keeps
  // stamp progress; the classic full-card one resets it.
  if (redeemSuccess && success) {
    const keptStamps = success.stamps > 0;
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
            <Animated.View entering={BODY_ENTER}>
              <Text style={styles.successTitle}>{t("success.rewardRedeemed")}</Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer.name}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {renderHeroCard(customer.stamps || 0, success.stamps, 0)}
            <Text style={styles.successNote}>
              {keptStamps ? t("success.progressKept", { name: customer.name }) : t("success.collectAgain")}
              {keptStamps && (success.rewards ?? 0) > 0
                ? `\n${rewardsWaitingText(success.rewards ?? 0)}`
                : ""}
            </Text>
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            <PressableScale style={styles.stampButton} onPress={handleDone}>
              <Text style={styles.stampButtonText}>{t("scanNext")}</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Stamp-added success states. All three share the header/hero/actions shape;
  // only the icon, title and the actions differ.
  if (success && !redeemSuccess) {
    const added = success.delta ?? Math.max(0, success.stamps - preStampStamps);
    const rolledOver = success.stamps < totalStamps && (success.rewards ?? 0) > preStampRewards;
    const completed = success.stamps >= totalStamps;
    const earnedReward = rolledOver || completed;
    // After a rollover the counter restarted, so the count-up runs from 0 in the
    // fresh cycle instead of dropping from the old (higher) number.
    const countFrom = rolledOver ? 0 : preStampStamps;
    const title = rolledOver
      ? t("success.rewardBanked")
      : completed
        ? t("success.cardComplete")
        : success.cap_applied
          ? t("cap.partialTitle")
          : t(`success.stampAdded_${plural(added)}`, { count: added });

    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[
                styles.successIcon,
                { backgroundColor: earnedReward ? UNLOCK_TINT : SUCCESS_TINT },
              ]}
            >
              {earnedReward ? (
                <Confetti size={36} color={UNLOCK_AMBER} weight="fill" />
              ) : (
                <Check size={36} color={SUCCESS_GREEN} weight="bold" />
              )}
            </Animated.View>
            <Animated.View entering={BODY_ENTER}>
              <Text style={styles.successTitle}>{title}</Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer.name}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {renderHeroCard(countFrom, success.stamps, added)}
            {rolledOver && (
              <Text style={styles.successNote}>
                {t("success.rewardBankedFor", { name: customer.name })}
                {"\n"}
                {rewardsWaitingText(success.rewards ?? 0)}
              </Text>
            )}
            {completed && <Text style={styles.successNote}>{t("success.cardFull")}</Text>}
            {success.cap_applied && (
              <Text style={styles.capNote}>
                {t(success.cap_scope === "week" ? "cap.partialWeek" : "cap.partialDay", {
                  added,
                  requested: success.cap_requested ?? added,
                })}
              </Text>
            )}
          </Animated.View>

          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            {completed && <Text style={styles.rewardPrompt}>{t("reward.prompt")}</Text>}
            {earnedReward ? (
              <>
                {renderRedeemButton()}
                <TouchableOpacity style={styles.skipButton} onPress={handleDone} disabled={redeeming}>
                  <Text style={styles.cancelText}>
                    {completed ? t("skipForNow") : t("scanNext")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <PressableScale style={styles.stampButton} onPress={handleDone}>
                <Text style={styles.stampButtonText}>{t("scanNext")}</Text>
              </PressableScale>
            )}
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Card is full and waiting on a redemption: no stamps can be added, so the
  // stepper is replaced by the redeem/skip choice.
  // Earning limit reached. Either the snapshot said so before the employee
  // pressed anything, or the request came back 409. Reward-ready wins: a
  // customer with a full card should be offered their reward first.
  const blockingCap =
    capError ??
    (!capOverride && earningCap && earningCap.remaining <= 0
      ? { ...earningCap, can_override: undefined }
      : null);
  if (blockingCap && !isReadyForReward && !success) {
    return (
      <CapBlockedScreen
        customerName={customer.name}
        cap={blockingCap}
        serverAllowsOverride={blockingCap.can_override}
        onOverride={handleWaive}
        overriding={stamping}
        errorMessage={error}
        onDone={handleDone}
        renderRedeemButton={hasBankedRewards ? renderRedeemButton : undefined}
      />
    );
  }

  if (isReadyForReward) {
    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[styles.successIcon, { backgroundColor: UNLOCK_TINT }]}
            >
              <Gift size={36} color={UNLOCK_AMBER} weight="fill" />
            </Animated.View>
            <Animated.View entering={BODY_ENTER}>
              <Text style={styles.successTitle}>{t("reward.banner")}</Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer.name}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {renderHeroCard(currentStamps, currentStamps, 0)}
            <Text style={styles.successNote}>{t("reward.entitled")}</Text>
            {error && (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            {renderRedeemButton()}
            <TouchableOpacity style={styles.skipButton} onPress={handleDone} disabled={redeeming}>
              <Text style={styles.cancelText}>{t("skipForNow")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Entry state: set the quantity, watch the card fill, commit in one press.
  return (
    <ConfirmationScaffold>
      <View style={styles.root}>
        <View style={styles.topGroup}>
          <CustomerHeader
            name={customer.name}
            balance={t("stampsCount", { current: currentStamps, total: totalStamps })}
            loading={false}
          />
          {hasBankedRewards && (
            <Animated.View entering={SOFT_ENTER} style={styles.chip}>
              <Gift size={18} color="#fff" weight="fill" />
              <Text style={styles.chipText}>
                {t(`rewardsBadge_${plural(rewards)}`, { count: rewards })}
              </Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.middle}>
          <StampGrid total={totalStamps} filled={currentStamps} pending={quantity} />
          <View style={styles.pendingRow}>
            {/* Keyed so the line re-animates as the promise changes, and the
                "completes the card" beat lands the moment it becomes true. */}
            <Animated.Text
              key={willCompleteCard ? "complete" : `pending-${quantity}`}
              entering={FadeIn.duration(160)}
              style={willCompleteCard ? styles.completeText : styles.pendingText}
            >
              {willCompleteCard
                ? t("quantity.completesCard")
                : t(`quantity.pending_${plural(quantity)}`, { count: quantity })}
            </Animated.Text>
          </View>
          {capOverride && (
            <Animated.View entering={SOFT_ENTER} style={styles.overrideNotice}>
              <Text style={styles.overrideNoticeText}>{t("cap.overrideActiveNotice")}</Text>
            </Animated.View>
          )}
          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.bottomGroup}>
          <StampStepper
            value={quantity}
            max={maxQuantity}
            onChange={setQuantity}
            disabled={stamping || redeeming}
          />

          <PressableScale
            style={[styles.stampButton, stamping && styles.buttonDisabled]}
            haptic="medium"
            onPress={() => handleAddStamp()}
            disabled={stamping || redeeming}
          >
            {stamping ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <Animated.Text key={quantity} entering={FadeIn.duration(140)} style={styles.stampButtonText}>
                {t(`addStamp_${plural(quantity)}`, { count: quantity })}
              </Animated.Text>
            )}
          </PressableScale>

          {hasBankedRewards && renderRedeemButton(stamping)}

          <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
            <Text style={styles.cancelText}>{tCommon("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ConfirmationScaffold>
  );
}
