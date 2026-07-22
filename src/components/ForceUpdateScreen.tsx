import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { StampeoLogo } from "@/components/ui/StampeoLogo";

// Fallbacks for when the gate response carries no store_url (defensive — the
// backend normally supplies it). Same links the web/showcase download CTAs use.
const APP_STORE_URL = "https://apps.apple.com/app/id6761758382";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.hryvnt.stampeo";

/**
 * Blocking "update required" gate, presented as a native modal that slides up
 * from the bottom and cannot be dismissed:
 *   - `animationType="slide"` → the native bottom-up transition.
 *   - `presentationStyle="fullScreen"` → covers everything, no iOS sheet swipe.
 *   - `onRequestClose` is a no-op → the Android hardware back button does nothing.
 * The only way out is to update the app.
 */
export function ForceUpdateScreen({
  visible,
  storeUrl,
}: {
  visible: boolean;
  storeUrl: string | null;
}) {
  const { t } = useTranslation("update");

  const handleUpdate = () => {
    const url =
      storeUrl ?? (Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        // No-op: the gate is undismissable. Android back must not close it.
      }}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <StampeoLogo size={48} color="#000000" />
          </View>
          <Text style={styles.title}>{t("title")}</Text>
          <Text style={styles.body}>{t("body")}</Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={handleUpdate}
          accessibilityRole="button"
          accessibilityLabel={t("button")}
        >
          <Text style={styles.buttonText}>{t("button")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0efe9",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  logoWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4b5563",
    textAlign: "center",
    maxWidth: 320,
  },
  button: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
});
