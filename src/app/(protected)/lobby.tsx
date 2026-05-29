import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBusiness } from "@/contexts/business-context";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { useAlert } from "@/contexts/alert-context";
import { useLocation } from "@/contexts/location-context";
import {
  CameraIcon,
  SignOutIcon,
  PauseCircleIcon,
  MapPinIcon,
  WarningCircleIcon,
} from "phosphor-react-native";
import { withOpacity } from "@/utils/colors";
import { QRCodeSkeleton } from "@/components/skeleton";
import { LocationPicker } from "@/components/LocationPicker";
import { ProximitySheet } from "@/components/ProximitySheet";
import { getLocationQR } from "@/api/locations";

const EXPLAINER_SEEN_KEY = "location_explainer_seen";

async function getExplainerSeen(): Promise<boolean> {
  if (Platform.OS === "web") return localStorage.getItem(EXPLAINER_SEEN_KEY) === "1";
  return (await AsyncStorage.getItem(EXPLAINER_SEEN_KEY)) === "1";
}

async function setExplainerSeen(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(EXPLAINER_SEEN_KEY, "1");
    return;
  }
  await AsyncStorage.setItem(EXPLAINER_SEEN_KEY, "1");
}


export default function LobbyScreen() {
  const router = useRouter();
  const { t } = useTranslation("lobby");
  const { t: tCommon } = useTranslation("common");
  const { t: tLocation } = useTranslation("location");
  const { currentBusiness, currentMembership, memberships } = useBusiness();
  const { theme, signupQR, qrLoading } = useTheme();
  const { signOut } = useAuth();
  const { alert } = useAlert();
  const {
    scannableLocations,
    requiresLocation,
    selectedLocation,
    isStranded,
    selectLocation,
    proximitySuggestion,
    dismissSuggestion,
    getPermissionStatus,
    requestLocationAndCheck,
  } = useLocation();

  const [locationQR, setLocationQR] = useState<string | null>(null);
  const [locationQRLoading, setLocationQRLoading] = useState(false);

  const hasMultipleBusinesses = memberships.length > 1;
  const isPaused = currentMembership?.is_paused ?? false;
  const showLocationPicker = requiresLocation && scannableLocations.length > 1;
  const showLocationLabel = requiresLocation && scannableLocations.length === 1 && !!selectedLocation;

  // When a location is selected (Pro multi-location), show that location's
  // enrollment QR instead of the business-wide one — never the "main" QR. With
  // no locations selected (non-Pro or pre-setup) we fall back to the signup QR.
  const useLocationQR = !!selectedLocation;
  const activeQRLoading = useLocationQR ? locationQRLoading : qrLoading;
  const activeQRSource = useLocationQR ? locationQR : signupQR?.qr_code ?? null;

  const handleStartScanning = () => {
    router.push("/scan");
  };

  // GPS proximity check on lobby load (Pro multi-location only). The explainer
  // precedes the OS prompt; an already-granted permission runs silently. GPS is
  // assistive only and never blocks scanning, so failures are swallowed upstream.
  const businessId = currentBusiness?.id;
  const hasAccessibleLocations = scannableLocations.length > 0;
  useEffect(() => {
    if (!businessId || !requiresLocation || !hasAccessibleLocations) return;
    let active = true;

    (async () => {
      const status = await getPermissionStatus();
      if (!active) return;
      if (status === "granted") {
        requestLocationAndCheck();
        return;
      }
      if (status === "undetermined") {
        if (await getExplainerSeen()) return;
        if (!active) return;
        await setExplainerSeen();
        alert(
          tLocation("permission.title"),
          tLocation("permission.body"),
          [
            { text: tLocation("permission.notNow"), style: "cancel" },
            {
              text: tLocation("permission.enable"),
              onPress: () => requestLocationAndCheck(),
            },
          ]
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [
    businessId,
    requiresLocation,
    hasAccessibleLocations,
    getPermissionStatus,
    requestLocationAndCheck,
    alert,
    tLocation,
  ]);

  // Fetch the selected location's enrollment QR.
  const selectedLocationId = selectedLocation?.id;
  useEffect(() => {
    if (!businessId || !selectedLocationId) {
      setLocationQR(null);
      return;
    }
    let active = true;
    setLocationQRLoading(true);
    getLocationQR(businessId, selectedLocationId)
      .then((res) => {
        if (!active) return;
        setLocationQR(
          res.qr_png_base64 ? `data:image/png;base64,${res.qr_png_base64}` : null
        );
      })
      .catch(() => {
        if (active) setLocationQR(null);
      })
      .finally(() => {
        if (active) setLocationQRLoading(false);
      });
    return () => {
      active = false;
    };
  }, [businessId, selectedLocationId]);

  const handleSwitchBusiness = () => {
    router.dismissTo("/businesses");
  };

  const handleSignOut = () => {
    alert(
      tCommon("signOutConfirmTitle"),
      tCommon("signOutConfirmMessage"),
      [
        { text: tCommon("signOutConfirmNo"), style: "cancel" },
        { text: tCommon("signOutConfirmYes"), style: "destructive", onPress: signOut },
      ]
    );
  };

  // Redirect to businesses screen if no business selected
  useEffect(() => {
    if (!currentBusiness) {
      router.replace("/businesses");
    }
  }, [currentBusiness, router]);

  // Memoize dynamic styles based on theme
  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          // backgroundColor: "#faf9f6",
          backgroundColor: theme.primary,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.background,
        },
        banner: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.primary,
          padding: 16,
          gap: 12,
        },
        logoPlaceholder: {
          width: 48,
          height: 48,
          borderRadius: 8,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
        },
        businessName: {
          fontSize: 17,
          fontWeight: "600",
          color: theme.primaryText,
        },
        roleText: {
          fontSize: 14,
          color: theme.primaryText,
        },
        content: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          // backgroundColor: "#f0efe9",
          backgroundColor: theme.background,
        },
        qrSection: {
          alignItems: "center",
          marginBottom: 32,
        },
        qrContainer: {
          backgroundColor: "#fff",
          padding: 16,
          borderRadius: 16,
          shadowColor: theme.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        qrPlaceholder: {
          width: 200,
          height: 200,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        },
        qrCode: {
          width: 200,
          height: 200,
        },
        qrLabel: {
          marginTop: 16,
          fontSize: 14,
          color: theme.textSecondary,
          textAlign: "center",
        },
        divider: {
          width: 60,
          height: 2,
          backgroundColor: withOpacity(theme.primary, 0.3),
          borderRadius: 1,
          marginVertical: 24,
        },
        scanButton: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.primary,
          paddingHorizontal: 32,
          paddingVertical: 16,
          borderRadius: 9999,
          gap: 10,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        },
        scanButtonText: {
          color: theme.primaryText,
          fontSize: 18,
          fontWeight: "600",
        },
      }),
    [theme]
  );

  if (!currentBusiness) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.loadingColor} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={["top"]}>
      {/* Business Banner */}
      <View style={dynamicStyles.banner}>
        <TouchableOpacity
          style={styles.bannerTouchable}
          onPress={hasMultipleBusinesses ? handleSwitchBusiness : undefined}
          activeOpacity={hasMultipleBusinesses ? 0.7 : 1}
        >
          {currentBusiness.logo_url ? (
            <View style={styles.logoContainer}>
              <Image
                source={currentBusiness.logo_url}
                style={styles.logo}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </View>
          ) : (
            <View style={dynamicStyles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>
                {currentBusiness.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.bannerInfo}>
            <Text style={dynamicStyles.businessName}>{currentBusiness.name}</Text>
            <Text style={dynamicStyles.roleText}>
              {currentMembership?.role
                ? tCommon(`roles.${currentMembership.role}` as "roles.owner" | "roles.admin" | "roles.scanner")
                : tCommon("roles.scanner")}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <SignOutIcon size={20} color={theme.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Location selector (Pro multi-location). Picker when 2+ choices,
          static label when the user can only scan at one. */}
      {showLocationPicker && (
        <View style={styles.locationHeader}>
          <LocationPicker
            locations={scannableLocations}
            selectedLocation={selectedLocation}
            onSelect={selectLocation}
          />
        </View>
      )}
      {showLocationLabel && (
        <View style={styles.locationHeader}>
          <View style={styles.locationLabel}>
            <MapPinIcon size={14} color="rgba(255, 255, 255, 0.9)" weight="fill" />
            <Text style={styles.locationLabelText} numberOfLines={1}>
              {selectedLocation?.name}
            </Text>
          </View>
        </View>
      )}

      {/* Main Content */}
      <View style={dynamicStyles.content}>
        {/* Signup QR Code */}
        <View style={dynamicStyles.qrSection}>
          <View style={dynamicStyles.qrContainer}>
            {activeQRLoading ? (
              <QRCodeSkeleton />
            ) : activeQRSource ? (
              <Image
                source={activeQRSource}
                style={dynamicStyles.qrCode}
                contentFit="contain"
              />
            ) : (
              <View style={dynamicStyles.qrPlaceholder}>
                <Text style={{ color: theme.textSecondary }}>
                  {t("qrUnavailable")}
                </Text>
              </View>
            )}
          </View>
          <Text style={dynamicStyles.qrLabel}>
            {t("qrLabel")}
          </Text>
        </View>

        <View style={dynamicStyles.divider} />

        {/* Paused Banner */}
        {isPaused && (
          <View style={styles.pausedBanner}>
            <PauseCircleIcon size={22} color="#D97706" weight="fill" />
            <View style={styles.pausedTextContainer}>
              <Text style={styles.pausedTitle}>{t("paused.banner")}</Text>
              <Text style={styles.pausedDescription}>{t("paused.description")}</Text>
            </View>
          </View>
        )}

        {/* Stranded scanner: assigned to no location on a multi-location
            business. Cannot scan until the owner assigns one. */}
        {isStranded ? (
          <View style={styles.strandedCard}>
            <WarningCircleIcon size={28} color="#D97706" weight="fill" />
            <Text style={styles.strandedTitle}>{tLocation("noneAssigned.title")}</Text>
            <Text style={styles.strandedBody}>{tLocation("noneAssigned.body")}</Text>
          </View>
        ) : (
          /* Scan Button */
          <TouchableOpacity
            style={[dynamicStyles.scanButton, isPaused && styles.scanButtonDisabled]}
            onPress={isPaused ? undefined : handleStartScanning}
            activeOpacity={isPaused ? 1 : 0.8}
          >
            <CameraIcon size={24} color={isPaused ? "#999" : theme.primaryText} weight="bold" />
            <Text style={[dynamicStyles.scanButtonText, isPaused && styles.scanButtonTextDisabled]}>
              {t("startScanning")}
            </Text>
          </TouchableOpacity>
        )}

        {/* Switch business hint when paused */}
        {isPaused && hasMultipleBusinesses && (
          <TouchableOpacity style={styles.switchHint} onPress={handleSwitchBusiness}>
            <Text style={styles.switchHintText}>{t("paused.switchBusiness")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* GPS proximity nudge: you seem to be at another location you can
          access. Suggestion only — "keep" leaves the selection untouched. */}
      <ProximitySheet
        suggestion={isPaused ? null : proximitySuggestion}
        currentName={selectedLocation?.name ?? ""}
        onSwitch={() =>
          proximitySuggestion && selectLocation(proximitySuggestion.location.id)
        }
        onKeep={dismissSuggestion}
      />
    </SafeAreaView>
  );
}

// Static styles that don't depend on theme
const styles = StyleSheet.create({
  locationHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  locationLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 9999,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginTop: 4,
  },
  locationLabelText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  strandedCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  strandedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    textAlign: "center",
  },
  strandedBody: {
    fontSize: 14,
    color: "#A16207",
    textAlign: "center",
    lineHeight: 20,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  logo: {
    width: 48,
    height: 48,
  },
  logoPlaceholderText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  bannerTouchable: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  bannerInfo: {
    flex: 1,
  },
  signOutButton: {
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  pausedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    width: "100%",
  },
  pausedTextContainer: {
    flex: 1,
  },
  pausedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  pausedDescription: {
    fontSize: 13,
    color: "#A16207",
    lineHeight: 18,
  },
  scanButtonDisabled: {
    backgroundColor: "#E5E5E5",
    shadowOpacity: 0,
    elevation: 0,
  },
  scanButtonTextDisabled: {
    color: "#999",
  },
  switchHint: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  switchHintText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textDecorationLine: "underline",
  },
});
