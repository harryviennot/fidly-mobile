import { useCallback, useRef, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { XIcon } from "phosphor-react-native";
import { useBusiness } from "@/contexts/business-context";
import { useTheme } from "@/contexts/theme-context";
import { withOpacity } from "@/utils/colors";


export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("scanner");
  const { t: tCommon } = useTranslation("common");
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const isProcessingRef = useRef(false);
  const { currentBusiness, currentMembership } = useBusiness();
  const { theme } = useTheme();

  // Reset scanned state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      isProcessingRef.current = false;
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
      alert(t("invalidQr"));
      setScanned(false);
      isProcessingRef.current = false;
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
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.title}>{t("permission.title")}</Text>
        <Text style={styles.text}>
          {t("permission.description")}
        </Text>
        <TouchableOpacity style={dynamicStyles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t("permission.grant")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleGoBack}>
          <Text style={styles.cancelText}>{tCommon("cancel")}</Text>
        </TouchableOpacity>
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
            <Text style={styles.roleText}>
              {currentMembership?.role
                ? tCommon(`roles.${currentMembership.role}` as "roles.owner" | "roles.admin" | "roles.scanner")
                : tCommon("roles.scanner")}
            </Text>
          </View>
        </View>
      )}

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

      {scanned && (
        <TouchableOpacity
          style={[dynamicStyles.rescanButton, { bottom: insets.bottom + 20 }]}
          onPress={() => {
            setScanned(false);
            isProcessingRef.current = false;
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
  cancelButton: {
    backgroundColor: "#000000",
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginTop: 16,
    borderRadius: 9999,
  },
  cancelText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rescanText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
