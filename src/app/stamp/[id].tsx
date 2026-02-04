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
import { WarningCircle, Confetti, Check, Gift } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { getCustomer, addStamp, redeemReward } from "@/api/customers";
import { useBusiness } from "@/contexts/business-context";
import { useTheme } from "@/contexts/theme-context";
import type { Customer, StampResponse } from "@/types/api";

export default function StampScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentBusiness } = useBusiness();
  const { theme, design } = useTheme();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [stamping, setStamping] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<StampResponse | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const totalStamps = design?.total_stamps ?? 10;
  const isReadyForReward = (customer?.stamps ?? 0) >= totalStamps;

  const loadCustomer = useCallback(async () => {
    if (!currentBusiness?.id) {
      setError("No business selected");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomer(currentBusiness.id, id);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [id, currentBusiness?.id]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  async function handleAddStamp() {
    if (!customer || !currentBusiness?.id || stamping) return;

    try {
      setStamping(true);
      setError(null);
      const result = await addStamp(currentBusiness.id, customer.id);
      setSuccess(result);
      setCustomer((prev) => (prev ? { ...prev, stamps: result.stamps } : null));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add stamp");
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
      const result = await redeemReward(currentBusiness.id, customer.id);
      setCustomer((prev) => (prev ? { ...prev, stamps: 0 } : null));
      setRedeemSuccess(true);
      setSuccess(result);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to redeem reward");
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
        <ActivityIndicator size="large" color={theme.loadingColor} />
        <Text style={dynamicStyles.loadingText}>Loading customer...</Text>
      </SafeAreaView>
    );
  }

  if (error && !customer) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={styles.errorIcon}>
          <WarningCircle size={48} color="#fff" weight="bold" />
        </View>
        <Text style={dynamicStyles.errorTitle}>Error</Text>
        <Text style={dynamicStyles.errorText}>{error}</Text>
        <TouchableOpacity style={dynamicStyles.button} onPress={handleGoHome}>
          <Text style={dynamicStyles.buttonText}>Go Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
          <Text style={dynamicStyles.cancelButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Reward redemption success state
  if (redeemSuccess && success) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={styles.rewardIcon}>
          <Confetti size={56} color="#fff" weight="fill" />
        </View>
        <Text style={dynamicStyles.successTitle}>Reward Redeemed!</Text>
        <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
          {customer?.name}&apos;s card has been reset.{"\n"}
          They can start collecting stamps again!
        </Text>

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>Stamps Reset</Text>
          <View style={styles.stampsRow}>
            {[...Array(totalStamps)].map((_, i) => (
              <View key={i} style={dynamicStyles.stampDot} />
            ))}
          </View>
          <Text style={dynamicStyles.stampsCount}>0 / {totalStamps}</Text>
        </View>

        <TouchableOpacity style={dynamicStyles.button} onPress={handleDone}>
          <Text style={dynamicStyles.buttonText}>Scan Next Customer</Text>
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
        <Text style={dynamicStyles.successTitle}>Card Complete!</Text>
        <Text style={[dynamicStyles.successMessage, { lineHeight: 24 }]}>
          Stamp added for {customer?.name}.{"\n"}
          Their card is now full!
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
            {success.stamps} / {totalStamps} - Card Full!
          </Text>
        </View>

        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}

        <Text style={dynamicStyles.rewardPrompt}>
          Would you like to redeem their reward now?
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
              <Text style={styles.redeemButtonText}>Redeem Reward</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleDone}
          disabled={redeeming}
        >
          <Text style={dynamicStyles.cancelButtonText}>Skip for Now</Text>
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
        <Text style={dynamicStyles.successTitle}>Stamp Added!</Text>
        <Text style={dynamicStyles.successMessage}>{success.message}</Text>

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>Current Stamps</Text>
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
            {success.stamps} / {totalStamps}
          </Text>
        </View>

        <TouchableOpacity style={dynamicStyles.button} onPress={handleDone}>
          <Text style={dynamicStyles.buttonText}>Scan Next Customer</Text>
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
            <Text style={styles.rewardBannerText}>Ready for Reward!</Text>
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
              {customer?.stamps} / {totalStamps} - Card Full!
            </Text>
          </View>

          {error && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          )}
        </View>

        <Text style={dynamicStyles.rewardPrompt}>
          This customer is entitled to their reward!
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
              <Text style={styles.redeemButtonText}>Redeem Reward</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkipReward}
          disabled={redeeming}
        >
          <Text style={dynamicStyles.cancelButtonText}>Skip for Now</Text>
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

        <View style={styles.stampsDisplay}>
          <Text style={dynamicStyles.stampsLabel}>Current Stamps</Text>
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
            {customer?.stamps || 0} / {totalStamps}
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
        disabled={stamping}
      >
        {stamping ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.stampButtonText}>Add Stamp</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
        <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
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
