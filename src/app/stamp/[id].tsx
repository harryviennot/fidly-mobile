import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getCustomer, addStamp, redeemReward } from "@/api/customers";
import { useAuth } from "@/contexts/auth-context";
import type { Customer, StampResponse } from "@/types/api";

const MAX_STAMPS = 10; // TODO: Get from card design

export default function StampScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appUser } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [stamping, setStamping] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<StampResponse | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const isReadyForReward = (customer?.stamps ?? 0) >= MAX_STAMPS;

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomer(id);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  async function handleAddStamp() {
    if (!customer || stamping) return;

    try {
      setStamping(true);
      setError(null);
      const result = await addStamp(customer.id, appUser?.id);
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
    if (!customer || redeeming) return;

    try {
      setRedeeming(true);
      setError(null);
      const result = await redeemReward(customer.id, appUser?.id);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#8B5A2B" />
        <Text style={styles.loadingText}>Loading customer...</Text>
      </SafeAreaView>
    );
  }

  if (error && !customer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorIcon}>
          <MaterialIcons name="error-outline" size={48} color="#fff" />
        </View>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleGoHome}>
          <Text style={styles.buttonText}>Go Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
          <Text style={styles.cancelButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Reward redemption success state
  if (redeemSuccess && success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.rewardIcon}>
          <MaterialIcons name="celebration" size={56} color="#fff" />
        </View>
        <Text style={styles.rewardTitle}>Reward Redeemed!</Text>
        <Text style={styles.rewardMessage}>
          {customer?.name}&apos;s card has been reset.{"\n"}
          They can start collecting stamps again!
        </Text>

        <View style={styles.stampsDisplay}>
          <Text style={styles.stampsLabel}>Stamps Reset</Text>
          <View style={styles.stampsRow}>
            {[...Array(MAX_STAMPS)].map((_, i) => (
              <View key={i} style={styles.stampDot} />
            ))}
          </View>
          <Text style={styles.stampsCount}>0 / {MAX_STAMPS}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>Scan Next Customer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Regular success state (stamp added)
  if (success && !redeemSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successIcon}>
          <MaterialIcons name="check" size={56} color="#fff" />
        </View>
        <Text style={styles.successTitle}>Stamp Added!</Text>
        <Text style={styles.successMessage}>{success.message}</Text>

        <View style={styles.stampsDisplay}>
          <Text style={styles.stampsLabel}>Current Stamps</Text>
          <View style={styles.stampsRow}>
            {[...Array(MAX_STAMPS)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stampDot,
                  i < success.stamps && styles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stampsCount}>
            {success.stamps} / {MAX_STAMPS}
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>Scan Next Customer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Show reward entitlement UI when at max stamps
  if (isReadyForReward) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.rewardBanner}>
            <MaterialIcons name="card-giftcard" size={32} color="#fff" />
            <Text style={styles.rewardBannerText}>Ready for Reward!</Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {customer?.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.customerName}>{customer?.name}</Text>
          <Text style={styles.customerEmail}>{customer?.email}</Text>

          <View style={styles.stampsDisplay}>
            <View style={styles.stampsRow}>
              {[...Array(MAX_STAMPS)].map((_, i) => (
                <View
                  key={i}
                  style={[styles.stampDot, styles.stampDotFilled]}
                />
              ))}
            </View>
            <Text style={styles.stampsCount}>
              {customer?.stamps} / {MAX_STAMPS} - Card Full!
            </Text>
          </View>

          {error && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          )}
        </View>

        <Text style={styles.rewardPrompt}>
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
              <MaterialIcons name="redeem" size={24} color="#fff" />
              <Text style={styles.redeemButtonText}>Redeem Reward</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkipReward}
          disabled={redeeming}
        >
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Normal stamp state
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {customer?.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.customerName}>{customer?.name}</Text>
        <Text style={styles.customerEmail}>{customer?.email}</Text>

        <View style={styles.stampsDisplay}>
          <Text style={styles.stampsLabel}>Current Stamps</Text>
          <View style={styles.stampsRow}>
            {[...Array(MAX_STAMPS)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stampDot,
                  i < (customer?.stamps || 0) && styles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stampsCount}>
            {customer?.stamps || 0} / {MAX_STAMPS}
          </Text>
        </View>

        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.stampButton, stamping && styles.buttonDisabled]}
        onPress={handleAddStamp}
        disabled={stamping}
      >
        {stamping ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.stampButtonIcon}>☕</Text>
            <Text style={styles.stampButtonText}>Add Stamp</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: "#666",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  rewardBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FF9800",
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8B5A2B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 48,
  },
  avatarText: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },
  customerName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  stampsDisplay: {
    alignItems: "center",
    width: "100%",
  },
  stampsLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stampsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  stampDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e0e0e0",
    borderWidth: 2,
    borderColor: "#ccc",
  },
  stampDotFilled: {
    backgroundColor: "#8B5A2B",
    borderColor: "#6B4423",
  },
  stampsCount: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  rewardPrompt: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  stampButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginTop: 24,
    width: "100%",
    gap: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  stampButtonIcon: {
    fontSize: 24,
  },
  stampButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  redeemButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
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
  skipButtonText: {
    color: "#666",
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f44336",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  inlineError: {
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    width: "100%",
  },
  inlineErrorText: {
    color: "#C62828",
    textAlign: "center",
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  rewardIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FF9800",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  rewardTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  rewardMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#8B5A2B",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
