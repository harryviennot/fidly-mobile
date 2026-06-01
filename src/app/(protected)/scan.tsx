import React, { useCallback, useRef, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { XIcon } from "phosphor-react-native";
import { useBusiness } from "@/contexts/business-context";
import { useTheme } from "@/contexts/theme-context";
import { useLocation } from "@/contexts/location-context";
import { withOpacity } from "@/utils/colors";


export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("scanner");
  const { t: tCommon } = useTranslation("common");
  const { t: tLocation } = useTranslation("location");
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);
  const { currentBusiness, currentMembership } = useBusiness();
  const { selectedLocation } = useLocation();
  const { theme } = useTheme();
  const isFocused = useIsFocused();

  // Reset scanned state when screen comes into focus.
  // Delay re-enabling the scanner so the camera doesn't immediately
  // re-detect the same QR code still in frame (especially on web).
  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => {
        setScanned(false);
        setScanError(null);
        isProcessingRef.current = false;
      }, 1500);
      return () => clearTimeout(timeout);
    }, [])
  );

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    setScanned(true);

    // The QR code contains the customer ID
    // Validate it looks like a UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(data)) {
      router.push(`/stamp/${data}`);
    } else {
      // Show inline error instead of alert() to prevent re-scan loop.
      // Keep scanned=true so the camera stays disabled until the user
      // taps "Scan Again" (by which time the invalid QR is out of frame).
      setScanError(t("invalidQr"));
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // Memoize dynamic styles based on theme
  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: withOpacity(theme.primary, 0.95),
          padding: 12,
          gap: 10,
        },
        logoPlaceholder: {
          width: 36,
          height: 36,
          borderRadius: 6,
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          justifyContent: "center",
          alignItems: "center",
        },
        button: {
          backgroundColor: theme.primary,
          paddingHorizontal: 32,
          paddingVertical: 16,
          borderRadius: 9999,
        },
        rescanButton: {
          position: "absolute",
          bottom: 40,
          left: 20,
          right: 20,
          backgroundColor: theme.primary,
          paddingVertical: 16,
          borderRadius: 9999,
          alignItems: "center",
        },
      }),
    [theme]
  );

  if (!permission) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.text}>{t("requestingPermission")}</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const canAsk = permission.canAskAgain;
    const isWeb = Platform.OS === "web";

    let permissionAction: React.ReactNode;
    const isInsecureContext = isWeb && globalThis.window !== undefined && !globalThis.isSecureContext;

    if (isInsecureContext) {
      permissionAction = (
        <Text style={styles.settingsHint}>{t("permission.insecureContext")}</Text>
      );
    } else if (canAsk) {
      permissionAction = (
        <TouchableOpacity style={dynamicStyles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t("permission.grant")}</Text>
        </TouchableOpacity>
      );
    } else if (isWeb) {
      permissionAction = (
        <Text style={styles.settingsHint}>{t("permission.browserHint")}</Text>
      );
    } else {
      permissionAction = (
        <TouchableOpacity style={dynamicStyles.button} onPress={() => Linking.openSettings()}>
          <Text style={styles.buttonText}>{t("permission.openSettings")}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.title}>{t("permission.title")}</Text>
        <Text style={styles.text}>
          {canAsk ? t("permission.description") : t("permission.denied")}
        </Text>
        {permissionAction}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Business Banner */}
      {currentBusiness && (
        <View style={[dynamicStyles.banner, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <XIcon size={24} color="#fff" weight="bold" />
          </TouchableOpacity>

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
            <Text style={styles.businessName} numberOfLines={1}>
              {currentBusiness.name}
            </Text>
            <Text style={styles.roleText} numberOfLines={1}>
              {selectedLocation
                ? tLocation("scanningAt", { name: selectedLocation.name })
                : currentMembership?.role
                  ? tCommon(`roles.${currentMembership.role}` as "roles.owner" | "roles.admin" | "roles.scanner")
                  : tCommon("roles.scanner")}
            </Text>
          </View>
        </View>
      )}

      {isFocused ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        >
          <View style={styles.overlay}>
            <View style={styles.unfocusedArea} />
            <View style={styles.middleRow}>
              <View style={styles.unfocusedArea} />
              <View style={styles.focusedArea}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.unfocusedArea} />
            </View>
            <View style={styles.unfocusedArea} />
          </View>

          <View style={styles.instructionContainer}>
            <Text style={styles.instruction}>
              {t("instruction")}
            </Text>
          </View>
        </CameraView>
      ) : (
        <View style={styles.camera} />
      )}

      {scanError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{scanError}</Text>
        </View>
      )}

      {scanned && (
        <TouchableOpacity
          style={[dynamicStyles.rescanButton, { bottom: insets.bottom + 20 }]}
          onPress={() => {
            setScanError(null);
            // Delay re-enabling the scanner so the camera doesn't
            // immediately re-detect the same QR code still in frame.
            setTimeout(() => {
              setScanned(false);
              isProcessingRef.current = false;
            }, 1500);
          }}
        >
          <Text style={styles.rescanText}>{t("rescan")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 36,
    height: 36,
  },
  logoPlaceholderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  bannerInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  roleText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  unfocusedArea: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  middleRow: {
    flexDirection: "row",
    height: 250,
  },
  focusedArea: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#fff",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  instructionContainer: {
    position: "absolute",
    bottom: 100,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  instruction: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  text: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rescanText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  settingsHint: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
    marginTop: 16,
  },
  errorBanner: {
    position: "absolute",
    bottom: 110,
    left: 20,
    right: 20,
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
});
