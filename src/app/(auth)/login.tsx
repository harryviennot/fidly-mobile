import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/auth-context";
import { StampeoLogo } from "@/components/ui/StampeoLogo";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";
import { supabase } from "@/lib/supabase";
import { getUserMemberships } from "@/api/memberships";

export default function LoginScreen() {
  const { t } = useTranslation("login");
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // After ANY successful auth, ensure the user has at least one membership.
  // Scanner-app is invite-only — orphan auth users (no business) are signed out.
  const enforceInviteOnly = async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    try {
      const memberships = await getUserMemberships(user.id);
      if (memberships.length === 0) {
        await supabase.auth.signOut({ scope: "local" });
        setError(t("errors.noAccount"));
        return false;
      }
      return true;
    } catch {
      // If membership fetch fails, leave the session intact and let the protected
      // layout handle the error. Don't block login on transient API failures.
      return true;
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t("errors.required"));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      await enforceInviteOnly();
    } catch {
      setError(t("errors.unexpected"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <StampeoLogo size={56} color="#000000" />
              <Text style={styles.subtitle}>{t("subtitle")}</Text>
            </View>

            <View style={styles.form}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <OAuthButtons
                disabled={loading}
                onSuccess={enforceInviteOnly}
                onError={(message) => setError(message)}
              />

              <OAuthDivider />

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("email")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("emailPlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("password")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("passwordPlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t("signIn")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0efe9",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000000",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
  },
  form: {
    gap: 16,
    width: "100%",
    maxWidth: 500,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2d3436",
  },
  input: {
    backgroundColor: "#faf9f6",
    borderWidth: 1,
    borderColor: "#ddd9d0",
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: "#2d3436",
  },
  error: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#f97316",
    borderRadius: 9999,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
