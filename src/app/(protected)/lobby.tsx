import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBusiness } from "@/contexts/business-context";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { CameraIcon, SignOutIcon } from "phosphor-react-native";
import { withOpacity } from "@/utils/colors";

const LOGO_HEIGHT = 48;
const MAX_LOGO_WIDTH = 120;

export default function LobbyScreen() {
  const router = useRouter();
  const { t } = useTranslation("lobby");
  const { t: tCommon } = useTranslation("common");
  const { currentBusiness, currentMembership, memberships } = useBusiness();
  const { theme, signupQR, qrLoading } = useTheme();
  const { signOut } = useAuth();

  const hasMultipleBusinesses = memberships.length > 1;
  const [logoWidth, setLogoWidth] = useState<number>(LOGO_HEIGHT);

  // Calculate logo width based on aspect ratio
  useEffect(() => {
    if (currentBusiness?.logo_url) {
      Image.getSize(
        currentBusiness.logo_url,
        (width, height) => {
          const aspectRatio = width / height;
          const calculatedWidth = Math.min(LOGO_HEIGHT * aspectRatio, MAX_LOGO_WIDTH);
          setLogoWidth(calculatedWidth);
        },
        () => setLogoWidth(LOGO_HEIGHT) // Fallback to square on error
      );
    }
  }, [currentBusiness?.logo_url]);

  const handleStartScanning = () => {
    router.push("/scan");
  };

  const handleSwitchBusiness = () => {
    router.dismissTo("/businesses");
  };

  const handleSignOut = () => {
    Alert.alert(
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
          borderBottomWidth: 1,
          borderBottomColor: "#ddd9d0",
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
            <Image
              source={{ uri: currentBusiness.logo_url }}
              style={{ width: logoWidth, height: LOGO_HEIGHT }}
              resizeMode="contain"
            />
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
          hitSlop={12}
          onPress={handleSignOut}
        >
          <SignOutIcon size={20} color={theme.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={dynamicStyles.content}>
        {/* Signup QR Code */}
        <View style={dynamicStyles.qrSection}>
          <View style={dynamicStyles.qrContainer}>
            {qrLoading ? (
              <View style={dynamicStyles.qrPlaceholder}>
                <ActivityIndicator size="large" color={theme.loadingColor} />
              </View>
            ) : signupQR ? (
              <Image
                source={{ uri: signupQR.qr_code }}
                style={dynamicStyles.qrCode}
                resizeMode="contain"
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

        {/* Scan Button */}
        <TouchableOpacity
          style={dynamicStyles.scanButton}
          onPress={handleStartScanning}
          activeOpacity={0.8}
        >
          <CameraIcon size={24} color={theme.primaryText} weight="bold" />
          <Text style={dynamicStyles.scanButtonText}>{t("startScanning")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Static styles that don't depend on theme
const styles = StyleSheet.create({
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
