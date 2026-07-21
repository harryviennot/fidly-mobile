import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Confetti, Check, Gift, PauseCircle } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { addStamp, redeemReward } from "@/api/customers";
import { markScanCompleted } from "@/lib/app-rating";
import { useLocation } from "@/contexts/location-context";
import { useTheme } from "@/contexts/theme-context";
import type { Customer, StampResponse } from "@/types/api";
import { PressableScale } from "@/components/PressableScale";
import { ConfirmationScaffold } from "./ConfirmationScaffold";
import { StatusScreen } from "./StatusScreen";
import { StampGrid } from "./StampGrid";
import { BODY_ENTER, ICON_ENTER, SOFT_ENTER } from "./animations";

interface StampFlowProps {
  customer: Customer;
  setCustomer: Dispatch<SetStateAction<Customer | null>>;
  businessId: string;
  enrollmentId: string;
}

/**
 * Stamp-program confirmation flow. Lifted from the original stamp/[id].tsx with
 * behavior unchanged — the dispatcher now owns the customer fetch, loading
 * skeleton and load-error screen, so this always receives a loaded customer.
 */
export function StampFlow({ customer, setCustomer, businessId, enrollmentId }: StampFlowProps) {
  const { t } = useTranslation("stamp");
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
  // Banked count before the last stamp — detects a rollover (stackable
  // rewards: stamps reset below total but a reward was banked).
  const [preStampRewards, setPreStampRewards] = useState(0);

  // Program config is the source of truth for the goal; the design column
  // is a deprecated synced copy kept as fallback.
  const totalStamps = customer.total_stamps ?? design?.total_stamps ?? 10;
  const stackable = customer.stackable_rewards ?? false;
  const maxStack = customer.max_stacked_rewards ?? null;
  const rewards = customer.rewards ?? 0;
  const cardFull = (customer.stamps ?? 0) >= totalStamps;
  // Blocked at the stack cap: behaves exactly like the classic full card.
  const atMaxStack = stackable && maxStack != null && rewards >= maxStack && cardFull;
  // Classic redeem-or-skip screen: non-stackable full card, or capped stack.
  const isReadyForReward = cardFull && (!stackable || atMaxStack);
  // Stackable flow: stamping continues, banked rewards redeemable anytime.
  const hasBankedRewards = stackable && rewards > 0 && !isReadyForReward;

  // Explicit singular/plural key selection: we know the count, so never
  // show a "(s)" guess. (Done in JS rather than i18next suffixes because
  // Hermes' Intl.PluralRules support is unreliable.)
  const rewardsWaitingText = (count: number) =>
    t(count === 1 ? "success.rewardsWaitingOne" : "success.rewardsWaiting", { count });

  async function handleAddStamp() {
    if (stamping) return;
    try {
      setStamping(true);
      setError(null);
      setPreStampRewards(customer.rewards ?? 0);
      const result = await addStamp(businessId, enrollmentId, selectedLocation?.id);
      setSuccess(result);
      setCustomer((prev) =>
        prev ? { ...prev, stamps: result.stamps, rewards: result.rewards ?? prev.rewards } : null
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Arm the one-time rating prompt. It is NOT shown here — it fires when the
      // employee next returns to the lobby, so it never interrupts scanning.
      markScanCompleted();
    } catch (err) {
      const code = (err as any)?.code;
      if (code === "MEMBER_PAUSED") {
        setIsPausedError(true);
      } else if (code === "CHECKOUT_REQUIRED") {
        setError(t("errors.checkoutRequired"));
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

  function handleSkipReward() {
    router.back();
  }

  function handleGoHome() {
    router.replace("/lobby");
  }

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

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 24,
          width: "100%",
          alignItems: "center",
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 4,
          overflow: "hidden",
        },
        avatar: {
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
          marginTop: 48,
        },
        customerName: {
          fontSize: 24,
          fontWeight: "bold",
          color: theme.text,
          marginBottom: 4,
        },
        customerEmail: {
          fontSize: 14,
          color: theme.textSecondary,
          marginBottom: 24,
        },
        stampsLabel: {
          fontSize: 12,
          color: theme.textSecondary,
          marginBottom: 12,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
        stampsCount: {
          fontSize: 18,
          fontWeight: "600",
          color: theme.text,
        },
        rewardPrompt: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
          marginTop: 16,
          marginBottom: 8,
        },
        button: {
          backgroundColor: theme.primary,
          paddingVertical: 16,
          paddingHorizontal: 32,
          borderRadius: 9999,
          marginTop: 24,
        },
        buttonText: {
          color: theme.primaryText,
          fontSize: 16,
          fontWeight: "600",
        },
        stampButton: {
          backgroundColor: "#000000",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 18,
          paddingHorizontal: 40,
          borderRadius: 9999,
          marginTop: 24,
          width: "100%",
          gap: 12,
        },
        cancelButtonText: {
          color: theme.textSecondary,
          fontSize: 16,
        },
        successTitle: {
          fontSize: 28,
          fontWeight: "bold",
          color: theme.text,
          marginBottom: 8,
        },
        successMessage: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
          marginBottom: 32,
        },
      }),
    [theme]
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

  // Reward redemption success state. A banked redemption (stackable rewards)
  // keeps stamp progress; the classic full-card one resets it.
  if (redeemSuccess && success) {
    const keptStamps = success.stamps > 0;
    return (
      <ConfirmationScaffold>
        <Animated.View entering={ICON_ENTER} style={styles.rewardIcon}>
          <Confetti size={56} color="#fff" weight="fill" />
        </Animated.View>
        <Animated.View entering={BODY_ENTER} style={styles.bodyWrap}>
          <Text style={dynamicStyles.successTitle}>{t("success.rewardRedeemed")}</Text>
          <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
            {keptStamps
              ? t("success.progressKept", { name: customer.name })
              : t("success.cardReset", { name: customer.name })}
            {"\n"}
            {keptStamps && (success.rewards ?? 0) > 0
              ? rewardsWaitingText(success.rewards ?? 0)
              : t("success.collectAgain")}
          </Text>

          <View style={styles.stampsDisplay}>
            <Text style={dynamicStyles.stampsLabel}>
              {keptStamps ? t("currentStamps") : t("stampsReset")}
            </Text>
            <StampGrid total={totalStamps} filled={success.stamps} />
            <Text style={dynamicStyles.stampsCount}>
              {t("stampsCount", { current: success.stamps, total: totalStamps })}
            </Text>
          </View>

          <PressableScale style={dynamicStyles.button} onPress={handleDone}>
            <Text style={dynamicStyles.buttonText}>{t("scanNext")}</Text>
          </PressableScale>
        </Animated.View>
      </ConfirmationScaffold>
    );
  }

  // Success state: stackable rollover - goal reached, reward banked, the card
  // already rolled into a fresh cycle.
  if (
    success &&
    !redeemSuccess &&
    success.stamps < totalStamps &&
    (success.rewards ?? 0) > preStampRewards
  ) {
    return (
      <ConfirmationScaffold>
        <Animated.View entering={ICON_ENTER} style={styles.completedIcon}>
          <Confetti size={56} color="#fff" weight="fill" />
        </Animated.View>
        <Animated.View entering={BODY_ENTER} style={styles.bodyWrap}>
          <Text style={dynamicStyles.successTitle}>{t("success.rewardBanked")}</Text>
          <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
            {t("success.rewardBankedFor", { name: customer.name })}{"\n"}
            {rewardsWaitingText(success.rewards ?? 0)}
          </Text>

          <View style={styles.stampsDisplay}>
            <Text style={dynamicStyles.stampsLabel}>{t("currentStamps")}</Text>
            <StampGrid total={totalStamps} filled={success.stamps} popLast />
            <Text style={dynamicStyles.stampsCount}>
              {t("stampsCount", { current: success.stamps, total: totalStamps })}
            </Text>
          </View>

          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}

          {renderRedeemButton()}

          <TouchableOpacity style={styles.skipButton} onPress={handleDone} disabled={redeeming}>
            <Text style={dynamicStyles.cancelButtonText}>{t("scanNext")}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ConfirmationScaffold>
    );
  }

  // Success state: stamp added AND card is now complete - show redeem option.
  if (success && !redeemSuccess && success.stamps >= totalStamps) {
    return (
      <ConfirmationScaffold>
        <Animated.View entering={ICON_ENTER} style={styles.completedIcon}>
          <Confetti size={56} color="#fff" weight="fill" />
        </Animated.View>
        <Animated.View entering={BODY_ENTER} style={styles.bodyWrap}>
          <Text style={dynamicStyles.successTitle}>{t("success.cardComplete")}</Text>
          <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
            {t("success.stampAddedFor", { name: customer.name })}{"\n"}
            {t("success.cardFull")}
          </Text>

          <View style={styles.stampsDisplay}>
            <StampGrid total={totalStamps} filled={totalStamps} popLast />
            <Text style={dynamicStyles.stampsCount}>
              {t("stampsCountFull", { current: success.stamps, total: totalStamps })}
            </Text>
          </View>

          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}

          <Text style={dynamicStyles.rewardPrompt}>{t("reward.prompt")}</Text>

          {renderRedeemButton()}

          <TouchableOpacity style={styles.skipButton} onPress={handleDone} disabled={redeeming}>
            <Text style={dynamicStyles.cancelButtonText}>{t("skipForNow")}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ConfirmationScaffold>
    );
  }

  // Regular success state (stamp added, card not complete).
  if (success && !redeemSuccess) {
    return (
      <ConfirmationScaffold>
        <Animated.View entering={ICON_ENTER} style={styles.successIcon}>
          <Check size={56} color="#fff" weight="bold" />
        </Animated.View>
        <Animated.View entering={BODY_ENTER} style={styles.bodyWrap}>
          <Text style={dynamicStyles.successTitle}>{t("success.stampAdded")}</Text>
          <Text style={dynamicStyles.successMessage}>{success.message}</Text>

          <View style={styles.stampsDisplay}>
            <Text style={dynamicStyles.stampsLabel}>{t("currentStamps")}</Text>
            <StampGrid total={totalStamps} filled={success.stamps} popLast />
            <Text style={dynamicStyles.stampsCount}>
              {t("stampsCount", { current: success.stamps, total: totalStamps })}
            </Text>
          </View>

          <PressableScale style={dynamicStyles.button} onPress={handleDone}>
            <Text style={dynamicStyles.buttonText}>{t("scanNext")}</Text>
          </PressableScale>
        </Animated.View>
      </ConfirmationScaffold>
    );
  }

  // Reward entitlement UI when at max stamps.
  if (isReadyForReward) {
    return (
      <ConfirmationScaffold>
        <Animated.View entering={SOFT_ENTER} style={dynamicStyles.card}>
          <View style={styles.rewardBanner}>
            <Gift size={32} color="#fff" weight="fill" />
            <Text style={styles.rewardBannerText}>{t("reward.banner")}</Text>
          </View>

          <View style={dynamicStyles.avatar}>
            <Text style={[styles.avatarText, { color: theme.primaryText }]}>{customer.name.charAt(0).toUpperCase()}</Text>
          </View>

          <Text style={dynamicStyles.customerName}>{customer.name}</Text>
          <Text style={dynamicStyles.customerEmail}>{customer.email}</Text>

          <View style={styles.stampsDisplay}>
            <StampGrid total={totalStamps} filled={totalStamps} />
            <Text style={dynamicStyles.stampsCount}>
              {t("stampsCountFull", { current: customer.stamps, total: totalStamps })}
            </Text>
          </View>

          {error && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          )}
        </Animated.View>

        <Text style={dynamicStyles.rewardPrompt}>{t("reward.entitled")}</Text>

        {renderRedeemButton()}

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipReward} disabled={redeeming}>
          <Text style={dynamicStyles.cancelButtonText}>{t("skipForNow")}</Text>
        </TouchableOpacity>
      </ConfirmationScaffold>
    );
  }

  // Normal stamp state.
  return (
    <ConfirmationScaffold>
      <Animated.View entering={SOFT_ENTER} style={dynamicStyles.card}>
        <View style={dynamicStyles.avatar}>
          <Text style={[styles.avatarText, { color: theme.primaryText }]}>{customer.name.charAt(0).toUpperCase()}</Text>
        </View>

        <Text style={dynamicStyles.customerName}>{customer.name}</Text>
        <Text style={dynamicStyles.customerEmail}>{customer.email}</Text>

        {hasBankedRewards && (
          <View style={styles.bankedBadge}>
            <Gift size={16} color="#b45309" weight="fill" />
            <Text style={styles.bankedBadgeText}>
              {t(rewards === 1 ? "rewardsBadgeOne" : "rewardsBadge", { count: rewards })}
            </Text>
          </View>
        )}

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>{t("currentStamps")}</Text>
          <StampGrid total={totalStamps} filled={customer.stamps || 0} />
          <Text style={dynamicStyles.stampsCount}>
            {t("stampsCount", { current: customer.stamps || 0, total: totalStamps })}
          </Text>
        </View>

        {error && (
          <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </Animated.View>
        )}
      </Animated.View>

      <PressableScale
        style={[dynamicStyles.stampButton, stamping && styles.buttonDisabled]}
        haptic="medium"
        onPress={handleAddStamp}
        disabled={stamping || redeeming}
      >
        {stamping ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.stampButtonText}>{t("addStamp")}</Text>
        )}
      </PressableScale>

      {hasBankedRewards && renderRedeemButton(stamping)}

      <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
        <Text style={dynamicStyles.cancelButtonText}>{tCommon("cancel")}</Text>
      </TouchableOpacity>
    </ConfirmationScaffold>
  );
}

// Static styles that don't depend on theme (lifted verbatim from the screen).
const styles = StyleSheet.create({
  rewardBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f59e0b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  rewardBannerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  avatarText: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },
  bankedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef3c7",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
    marginBottom: 16,
  },
  bankedBadgeText: {
    color: "#b45309",
    fontSize: 14,
    fontWeight: "600",
  },
  stampsDisplay: {
    alignItems: "center",
    width: "100%",
  },
  bodyWrap: {
    width: "100%",
    alignItems: "center",
  },
  stampButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  redeemButton: {
    backgroundColor: "#22c55e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 9999,
    marginTop: 16,
    width: "100%",
    gap: 12,
  },
  redeemButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  skipButton: {
    marginTop: 12,
    padding: 16,
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
  },
  inlineError: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    width: "100%",
  },
  inlineErrorText: {
    color: "#dc2626",
    textAlign: "center",
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  rewardIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  completedIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
});
