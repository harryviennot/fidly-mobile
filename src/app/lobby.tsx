import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useBusiness } from "@/contexts/business-context";
import { useAuth } from "@/contexts/auth-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function LobbyScreen() {
  const router = useRouter();
  const { currentBusiness, currentMembership, memberships } = useBusiness();
  const { signOut } = useAuth();

  const hasMultipleBusinesses = memberships.length > 1;

  const handleStartScanning = () => {
    router.push("/scan");
  };

  const handleSwitchBusiness = () => {
    router.replace("/businesses");
  };

  if (!currentBusiness) {
    router.replace("/businesses");
    return null;
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

        {hasMultipleBusinesses && (
          <MaterialIcons name="swap-horiz" size={24} color="#8B5A2B" />
        )}
      </TouchableOpacity>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="qr-code-scanner" size={80} color="#8B5A2B" />
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
          <MaterialIcons name="camera-alt" size={24} color="#fff" />
          <Text style={styles.scanButtonText}>Start Scanning</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {hasMultipleBusinesses && (
          <TouchableOpacity
            style={styles.switchButton}
            onPress={handleSwitchBusiness}
          >
            <MaterialIcons name="business" size={20} color="#666" />
            <Text style={styles.switchButtonText}>Switch Business</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <MaterialIcons name="logout" size={20} color="#666" />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#8B5A2B",
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
    color: "#333",
  },
  roleText: {
    fontSize: 14,
    color: "#666",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(139, 90, 43, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5A2B",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  switchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  switchButtonText: {
    fontSize: 14,
    color: "#666",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  signOutButtonText: {
    fontSize: 14,
    color: "#666",
  },
});
