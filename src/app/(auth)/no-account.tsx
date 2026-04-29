import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StampeoLogo } from "@/components/ui/StampeoLogo";

const SHOWCASE_BASE_URL = "https://stampeo.app";

export default function NoAccountScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation("login");

  const locale = i18n.language?.startsWith("fr") ? "fr" : "en";
  const onboardingUrl = `${SHOWCASE_BASE_URL}/${locale}/onboarding`;

  const handleCreateBusiness = () => {
    if (Platform.OS === "web") {
      globalThis.location.href = onboardingUrl;
    } else {
      Linking.openURL(onboardingUrl).catch(() => {});
    }
  };

  const handleBackToLogin = () => {
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <StampeoLogo size={56} color="#000000" />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{t("noAccount.title")}</Text>
          <Text style={styles.message}>{t("noAccount.message")}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateBusiness}>
            <Text style={styles.primaryButtonText}>{t("noAccount.createBusiness")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleBackToLogin}>
            <Text style={styles.secondaryButtonText}>{t("noAccount.backToLogin")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0efe9",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 32,
  },
  header: {
    alignItems: "center",
  },
  body: {
    alignItems: "center",
    gap: 12,
    maxWidth: 500,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2d3436",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },
  actions: {
    width: "100%",
    maxWidth: 500,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#f97316",
    borderRadius: 9999,
    padding: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 9999,
    padding: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2d3436",
    fontSize: 16,
    fontWeight: "500",
  },
});
