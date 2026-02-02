import { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useBusiness } from "@/contexts/business-context";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const isProcessingRef = useRef(false);
  const { currentBusiness, currentMembership, memberships } = useBusiness();

  const hasMultipleBusinesses = memberships.length > 1;

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
      alert("Invalid QR code. Please scan a valid loyalty card.");
      setScanned(false);
      isProcessingRef.current = false;
    }
  };

  const handleSwitchBusiness = () => {
    router.replace("/businesses");
  };

  const handleGoBack = () => {
    router.back();
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.text}>
          We need camera access to scan customer loyalty cards.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Business Banner */}
      {currentBusiness && (
        <TouchableOpacity
          style={[styles.banner, { paddingTop: insets.top + 12 }]}
          onPress={hasMultipleBusinesses ? handleSwitchBusiness : undefined}
          activeOpacity={hasMultipleBusinesses ? 0.7 : 1}
        >
          {currentBusiness.logo_url ? (
            <Image
              source={{ uri: currentBusiness.logo_url }}
              style={styles.logo}
            />
          ) : (
            <View style={styles.logoPlaceholder}>
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
                ? currentMembership.role.charAt(0).toUpperCase() +
                  currentMembership.role.slice(1)
                : "Scanner"}
            </Text>
          </View>

          {hasMultipleBusinesses && (
            <MaterialIcons name="swap-horiz" size={20} color="#fff" />
          )}
        </TouchableOpacity>
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
            Point camera at the customer loyalty card QR code
          </Text>
        </View>
      </CameraView>

      {scanned && (
        <TouchableOpacity
          style={[styles.rescanButton, { bottom: insets.bottom + 20 }]}
          onPress={() => {
            setScanned(false);
            isProcessingRef.current = false;
          }}
        >
          <Text style={styles.rescanText}>Tap to Scan Again</Text>
        </TouchableOpacity>
      )}

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={handleGoBack}
      >
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 90, 43, 0.95)",
    padding: 12,
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  logoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
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
    left: 0,
    right: 0,
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
  button: {
    backgroundColor: "#8B5A2B",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rescanButton: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#8B5A2B",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  rescanText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});
