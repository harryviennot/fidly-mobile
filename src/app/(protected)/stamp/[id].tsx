import { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { WarningCircle, Confetti, Check, Gift, PauseCircle } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { getCustomer, addStamp, redeemReward } from "@/api/customers";
import { useBusiness } from "@/contexts/business-context";
import { useLocation } from "@/contexts/location-context";
import { useTheme } from "@/contexts/theme-context";
import { CustomerCardSkeleton } from "@/components/skeleton";
import type { Customer, StampResponse } from "@/types/api";

export default function StampScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation("stamp");
  const { t: tCommon } = useTranslation("common");
  const { t: tLocation } = useTranslation("location");
  const { currentBusiness } = useBusiness();
  const { selectedLocation } = useLocation();
  const { theme, design } = useTheme();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
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
  const totalStamps = customer?.total_stamps ?? design?.total_stamps ?? 10;
  const stackable = customer?.stackable_rewards ?? false;
  const maxStack = customer?.max_stacked_rewards ?? null;
  const rewards = customer?.rewards ?? 0;
  const cardFull = (customer?.stamps ?? 0) >= totalStamps;
  // Blocked at the stack cap: behaves exactly like the classic full card.
  const atMaxStack = stackable && maxStack != null && rewards >= maxStack && cardFull;
  // Classic redeem-or-skip screen: non-stackable full card, or capped stack.
  const isReadyForReward = cardFull && (!stackable || atMaxStack);
  // Stackable flow: stamping continues, banked rewards redeemable anytime.
  const hasBankedRewards = stackable && rewards > 0 && !isReadyForReward;

  const loadCustomer = useCallback(async () => {
    if (!currentBusiness?.id) {
      setError(t("errors.noBusinessSelected"));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomer(currentBusiness.id, id);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, currentBusiness?.id, t]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  async function handleAddStamp() {
    if (!customer || !currentBusiness?.id || stamping) return;

    try {
      setStamping(true);
      setError(null);
      // Phase 4: /stamps takes enrollment_id. Post-Phase-3 every QR returns
      // an enrollment_id, which is the URL `id` here — send it directly
      // instead of round-tripping through customer.id. On Pro multi-location
      // businesses we attach the lobby-selected location for attribution.
      setPreStampRewards(customer.rewards ?? 0);
      const result = await addStamp(currentBusiness.id, id, selectedLocation?.id);
      setSuccess(result);
      setCustomer((prev) =>
        prev
          ? { ...prev, stamps: result.stamps, rewards: result.rewards ?? prev.rewards }
          : null
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      } else {
        setError(err instanceof Error ? err.message : t("errors.stampFailed"));
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStamping(false);
    }
  }

  async function handleRedeemReward() {
    if (!customer || !currentBusiness?.id || redeeming) return;

    try {
      setRedeeming(true);
      setError(null);
      const result = await redeemReward(currentBusiness.id, id);
      // Banked redemptions keep stamp progress; only the classic full-card
      // redemption resets to 0. Trust the server's response either way.
      setCustomer((prev) =>
        prev
          ? { ...prev, stamps: result.stamps, rewards: result.rewards ?? 0 }
          : null
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

  function handleSkipReward() {
    router.back();
  }

  function handleDone() {
    router.back();
  }

  function handleGoHome() {
    router.replace("/lobby");
  }

  // Dynamic styles based on theme
  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
          padding: 20,
          justifyContent: "center",
          alignItems: "center",
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
        },
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
        stampDot: {
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: theme.stampEmpty,
          borderWidth: 2,
          borderColor: theme.stampBorder,
        },
        stampDotFilled: {
          backgroundColor: theme.stampFilled,
          borderColor: theme.accent,
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
        errorTitle: {
          fontSize: 24,
          fontWeight: "bold",
          color: theme.text,
          marginBottom: 8,
        },
        errorText: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
          marginBottom: 24,
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
        loadingText: {
          marginTop: 16,
          color: theme.textSecondary,
          fontSize: 16,
        },
      }),
    [theme]
  );

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <CustomerCardSkeleton
          totalStamps={totalStamps}
          theme={{ surface: theme.surface, text: theme.text }}
        />
      </SafeAreaView>
    );
  }

  // Paused member error — shown as dedicated screen with Go Home action
  if (isPausedError) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={[styles.errorIcon, { backgroundColor: "#D97706" }]}>
          <PauseCircle size={48} color="#fff" weight="fill" />
        </View>
        <Text style={dynamicStyles.errorTitle}>{t("errors.pausedTitle")}</Text>
        <Text style={dynamicStyles.errorText}>{t("errors.pausedMessage")}</Text>
        <TouchableOpacity style={dynamicStyles.button} onPress={handleGoHome}>
          <Text style={dynamicStyles.buttonText}>{t("errors.goHome")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (error && !customer) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={styles.errorIcon}>
          <WarningCircle size={48} color="#fff" weight="bold" />
        </View>
        <Text style={dynamicStyles.errorTitle}>{tCommon("error")}</Text>
        <Text style={dynamicStyles.errorText}>{error}</Text>
        <TouchableOpacity style={dynamicStyles.button} onPress={handleGoHome}>
          <Text style={dynamicStyles.buttonText}>{tCommon("goHome")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
          <Text style={dynamicStyles.cancelButtonText}>{tCommon("goBack")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Reward redemption success state. A banked redemption (stackable
  // rewards) keeps stamp progress; the classic full-card one resets it.
  if (redeemSuccess && success) {
    const keptStamps = success.stamps > 0;
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={styles.rewardIcon}>
          <Confetti size={56} color="#fff" weight="fill" />
        </View>
        <Text style={dynamicStyles.successTitle}>{t("success.rewardRedeemed")}</Text>
        <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
          {keptStamps
            ? t("success.progressKept", { name: customer?.name })
            : t("success.cardReset", { name: customer?.name })}
          {"\n"}
          {keptStamps && (success.rewards ?? 0) > 0
            ? t("success.rewardsWaiting", { count: success.rewards })
            : t("success.collectAgain")}
        </Text>

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>
            {keptStamps ? t("currentStamps") : t("stampsReset")}
          </Text>
          <View style={styles.stampsRow}>
            {[...Array(totalStamps)].map((_, i) => (
              <View
                key={i}
                style={[
                  dynamicStyles.stampDot,
                  i < success.stamps && dynamicStyles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={dynamicStyles.stampsCount}>{t("stampsCount", { current: success.stamps, total: totalStamps })}</Text>
        </View>

        <TouchableOpacity style={dynamicStyles.button} onPress={handleDone}>
          <Text style={dynamicStyles.buttonText}>{t("scanNext")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Success state: stackable rollover - the goal was reached, the reward is
  // banked and the card already rolled into a fresh cycle.
  if (
    success &&
    !redeemSuccess &&
    success.stamps < totalStamps &&
    (success.rewards ?? 0) > preStampRewards
  ) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={styles.completedIcon}>
          <Confetti size={56} color="#fff" weight="fill" />
        </View>
        <Text style={dynamicStyles.successTitle}>{t("success.rewardBanked")}</Text>
        <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
          {t("success.rewardBankedFor", { name: customer?.name })}{"\n"}
          {t("success.rewardsWaiting", { count: success.rewards })}
        </Text>

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>{t("currentStamps")}</Text>
          <View style={styles.stampsRow}>
            {[...Array(totalStamps)].map((_, i) => (
              <View
                key={i}
                style={[
                  dynamicStyles.stampDot,
                  i < success.stamps && dynamicStyles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={dynamicStyles.stampsCount}>
            {t("stampsCount", { current: success.stamps, total: totalStamps })}
          </Text>
        </View>

        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.redeemButton, redeeming && styles.buttonDisabled]}
          onPress={handleRedeemReward}
          disabled={redeeming}
        >
          {redeeming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Gift size={24} color="#fff" weight="bold" />
              <Text style={styles.redeemButtonText}>{t("redeemReward")}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleDone} disabled={redeeming}>
          <Text style={dynamicStyles.cancelButtonText}>{t("scanNext")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Success state: stamp added AND card is now complete - show redeem option
  if (success && !redeemSuccess && success.stamps >= totalStamps) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={styles.completedIcon}>
          <Confetti size={56} color="#fff" weight="fill" />
        </View>
        <Text style={dynamicStyles.successTitle}>{t("success.cardComplete")}</Text>
        <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
          {t("success.stampAddedFor", { name: customer?.name })}{"\n"}
          {t("success.cardFull")}
        </Text>

        <View style={styles.stampsDisplay}>
          <View style={styles.stampsRow}>
            {[...Array(totalStamps)].map((_, i) => (
              <View
                key={i}
                style={[dynamicStyles.stampDot, dynamicStyles.stampDotFilled]}
              />
            ))}
          </View>
          <Text style={dynamicStyles.stampsCount}>
            {t("stampsCountFull", { current: success.stamps, total: totalStamps })}
          </Text>
        </View>

        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}

        <Text style={dynamicStyles.rewardPrompt}>
          {t("reward.prompt")}
        </Text>

        <TouchableOpacity
          style={[styles.redeemButton, redeeming && styles.buttonDisabled]}
          onPress={handleRedeemReward}
          disabled={redeeming}
        >
          {redeeming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Gift size={24} color="#fff" weight="bold" />
              <Text style={styles.redeemButtonText}>{t("redeemReward")}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleDone}
          disabled={redeeming}
        >
          <Text style={dynamicStyles.cancelButtonText}>{t("skipForNow")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Regular success state (stamp added, card not complete)
  if (success && !redeemSuccess) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={styles.successIcon}>
          <Check size={56} color="#fff" weight="bold" />
        </View>
        <Text style={dynamicStyles.successTitle}>{t("success.stampAdded")}</Text>
        <Text style={dynamicStyles.successMessage}>{success.message}</Text>

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>{t("currentStamps")}</Text>
          <View style={styles.stampsRow}>
            {[...Array(totalStamps)].map((_, i) => (
              <View
                key={i}
                style={[
                  dynamicStyles.stampDot,
                  i < success.stamps && dynamicStyles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={dynamicStyles.stampsCount}>
            {t("stampsCount", { current: success.stamps, total: totalStamps })}
          </Text>
        </View>

        <TouchableOpacity style={dynamicStyles.button} onPress={handleDone}>
          <Text style={dynamicStyles.buttonText}>{t("scanNext")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Show reward entitlement UI when at max stamps
  if (isReadyForReward) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.card}>
          <View style={styles.rewardBanner}>
            <Gift size={32} color="#fff" weight="fill" />
            <Text style={styles.rewardBannerText}>{t("reward.banner")}</Text>
          </View>

          <View style={dynamicStyles.avatar}>
            <Text style={styles.avatarText}>
              {customer?.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={dynamicStyles.customerName}>{customer?.name}</Text>
          <Text style={dynamicStyles.customerEmail}>{customer?.email}</Text>

          <View style={styles.stampsDisplay}>
            <View style={styles.stampsRow}>
              {[...Array(totalStamps)].map((_, i) => (
                <View
                  key={i}
                  style={[dynamicStyles.stampDot, dynamicStyles.stampDotFilled]}
                />
              ))}
            </View>
            <Text style={dynamicStyles.stampsCount}>
              {t("stampsCountFull", { current: customer?.stamps, total: totalStamps })}
            </Text>
          </View>

          {error && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          )}
        </View>

        <Text style={dynamicStyles.rewardPrompt}>
          {t("reward.entitled")}
        </Text>

        <TouchableOpacity
          style={[styles.redeemButton, redeeming && styles.buttonDisabled]}
          onPress={handleRedeemReward}
          disabled={redeeming}
        >
          {redeeming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Gift size={24} color="#fff" weight="bold" />
              <Text style={styles.redeemButtonText}>{t("redeemReward")}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkipReward}
          disabled={redeeming}
        >
          <Text style={dynamicStyles.cancelButtonText}>{t("skipForNow")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Normal stamp state
  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.card}>
        <View style={dynamicStyles.avatar}>
          <Text style={styles.avatarText}>
            {customer?.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={dynamicStyles.customerName}>{customer?.name}</Text>
        <Text style={dynamicStyles.customerEmail}>{customer?.email}</Text>

        {hasBankedRewards && (
          <View style={styles.bankedBadge}>
            <Gift size={16} color="#b45309" weight="fill" />
            <Text style={styles.bankedBadgeText}>
              {t("rewardsBadge", { count: rewards })}
            </Text>
          </View>
        )}

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>{t("currentStamps")}</Text>
          <View style={styles.stampsRow}>
            {[...Array(totalStamps)].map((_, i) => (
              <View
                key={i}
                style={[
                  dynamicStyles.stampDot,
                  i < (customer?.stamps || 0) && dynamicStyles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={dynamicStyles.stampsCount}>
            {t("stampsCount", { current: customer?.stamps || 0, total: totalStamps })}
          </Text>
        </View>

        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[dynamicStyles.stampButton, stamping && styles.buttonDisabled]}
        onPress={handleAddStamp}
        disabled={stamping || redeeming}
      >
        {stamping ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.stampButtonText}>{t("addStamp")}</Text>
        )}
      </TouchableOpacity>

      {hasBankedRewards && (
        <TouchableOpacity
          style={[styles.redeemButton, redeeming && styles.buttonDisabled]}
          onPress={handleRedeemReward}
          disabled={stamping || redeeming}
        >
          {redeeming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Gift size={24} color="#fff" weight="bold" />
              <Text style={styles.redeemButtonText}>{t("redeemReward")}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
        <Text style={dynamicStyles.cancelButtonText}>{tCommon("cancel")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Static styles that don't depend on theme
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
  stampsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
    justifyContent: "center",
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
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
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
