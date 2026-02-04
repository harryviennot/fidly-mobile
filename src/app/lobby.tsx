import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useBusiness } from "@/contexts/business-context";
import { useAuth } from "@/contexts/auth-context";
import { ArrowsLeftRight, QrCode, Camera, Buildings, SignOut } from "phosphor-react-native";
import { StampeoLogo } from "@/components/ui/StampeoLogo";
import { SignupQRModal } from "@/components/signup-qr-modal";

export default function LobbyScreen() {
  const router = useRouter();
  const { currentBusiness, currentMembership, memberships } = useBusiness();
  const { signOut } = useAuth();
  const [showQRModal, setShowQRModal] = useState(false);

  const hasMultipleBusinesses = memberships.length > 1;

  const handleStartScanning = () => {
    router.push("/scan");
  };

  const handleSwitchBusiness = () => {
    router.replace("/businesses");
  };

  // Redirect to businesses screen if no business selected (must be in useEffect)
  useEffect(() => {
    if (!currentBusiness) {
      router.replace("/businesses");
    }
  }, [currentBusiness, router]);

  if (!currentBusiness) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Business Banner */}
      <TouchableOpacity
        style={styles.banner}
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
          <Text style={styles.businessName}>{currentBusiness.name}</Text>
          <Text style={styles.roleText}>
            {currentMembership?.role
              ? currentMembership.role.charAt(0).toUpperCase() +
              currentMembership.role.slice(1)
              : "Scanner"}
          </Text>




        </View>

        <TouchableOpacity style={styles.signOutFooterButton} hitSlop={12} onPress={signOut}>
          <SignOut size={20} color="#6b7280" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <QrCode size={80} color="#f97316" weight="duotone" />
        </View>

        <Text style={styles.title}>Ready to Scan</Text>
        <Text style={styles.subtitle}>
          Tap the button below to start scanning{"\n"}customer loyalty cards
        </Text>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleStartScanning}
          activeOpacity={0.8}
        >
          <Camera size={24} color="#fff" weight="bold" />
          <Text style={styles.scanButtonText}>Start Scanning</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setShowQRModal(true)}
          activeOpacity={0.8}
        >
          <QrCode size={24} color="#f97316" weight="bold" />
          <Text style={styles.qrButtonText}>Show Signup QR</Text>
        </TouchableOpacity>
      </View>

      {currentBusiness && (
        <SignupQRModal
          visible={showQRModal}
          onClose={() => setShowQRModal(false)}
          businessId={currentBusiness.id}
          businessName={currentBusiness.name}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0efe9",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    backgroundColor: "#faf9f6",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd9d0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f97316",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#faf9f6",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd9d0",
  },
  logo: {
    width: 48,
    height: 48,
    // borderRadius: 8,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#f97316",
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  bannerInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2d3436",
  },
  roleText: {
    fontSize: 14,
    color: "#6b7280",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f0efe9",
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2d3436",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f97316",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 10,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#faf9f6",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 9999,
    gap: 10,
    marginTop: 12,
    borderWidth: 2,
    borderColor: "#f97316",
  },
  qrButtonText: {
    color: "#f97316",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#ddd9d0",
    backgroundColor: "#faf9f6",
  },
  switchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  switchButtonText: {
    fontSize: 14,
    color: "#6b7280",
  },
  signOutFooterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  signOutButtonText: {
    fontSize: 14,
    color: "#6b7280",
  },
});
