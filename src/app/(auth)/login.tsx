import { useCallback, useEffect, useRef, useState } from "react";
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
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "phosphor-react-native";
import { useAuth } from "@/contexts/auth-context";
import { StampeoLogo } from "@/components/ui/StampeoLogo";
import { AuthMethodChooser } from "@/components/auth/AuthMethodChooser";
import { supabase } from "@/lib/supabase";
import { writeLastLogin, type LastLoginMethod } from "@/lib/last-login";
import { getUserMemberships } from "@/api/memberships";

const SHOWCASE_BASE_URL = "https://stampeo.app";

type Phase = "choose" | "credentials";

export default function LoginScreen() {
  const { t, i18n } = useTranslation("login");
  const router = useRouter();
  const { signIn } = useAuth();
  const [phase, setPhase] = useState<Phase>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthCallbackInFlight, setOauthCallbackInFlight] = useState(
    () =>
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      /[?&](code|error)=/.test(window.location.search)
  );
  const oauthHandledRef = useRef(false);

  const locale = i18n.language?.startsWith("fr") ? "fr" : "en";
  const onboardingUrl = `${SHOWCASE_BASE_URL}/${locale}/onboarding`;

  // Translate raw Supabase error messages into friendly, localised copy.
  const translateError = useCallback(
    (message: string) => {
      const msg = message.toLowerCase();
      if (
        msg.includes("invalid") &&
        (msg.includes("credentials") || msg.includes("password") || msg.includes("login"))
      ) {
        return t("errors.invalidCredentials");
      }
      if (msg.includes("rate") || msg.includes("too many") || msg.includes("429")) {
        return t("errors.tooManyRequests");
      }
      if (msg.includes("user not found") || msg.includes("no user")) {
        return t("errors.userNotFound");
      }
      if (msg.includes("network") || msg.includes("fetch")) {
        return t("errors.networkError");
      }
      return t("errors.generic");
    },
    [t]
  );

  // After ANY successful auth, ensure the user has at least one membership.
  // Scanner-app is invite-only — orphan auth users (no business) are signed
  // out and routed to the no-account screen.
  const enforceInviteOnly = useCallback(async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    try {
      const memberships = await getUserMemberships(user.id);
      if (memberships.length === 0) {
        await supabase.auth.signOut({ scope: "local" });
        router.replace("/(auth)/no-account");
        return false;
      }
      return true;
    } catch {
      // If membership fetch fails, leave the session intact and let the
      // protected layout handle the error. Don't block login on transient
      // API failures.
      return true;
    }
  }, [router]);

  // Web-only: handle the OAuth provider redirect (?code=...). With the
  // @supabase/ssr browser client we use PKCE, so we must call
  // exchangeCodeForSession explicitly. The verifier cookie was set on the
  // shared parent domain by signInWithOAuth before the redirect.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;
    if (oauthHandledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");
    const oauthErrorDescription = params.get("error_description");

    if (!code && !oauthError) return;

    oauthHandledRef.current = true;

    const stripUrl = () => {
      window.history.replaceState({}, "", window.location.pathname);
    };

    if (oauthError) {
      setError(translateError(oauthErrorDescription ?? oauthError));
      setOauthCallbackInFlight(false);
      stripUrl();
      return;
    }

    (async () => {
      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          code!
        );
        if (exchangeError) {
          setError(translateError(exchangeError.message));
          setOauthCallbackInFlight(false);
          stripUrl();
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const provider = user?.app_metadata?.provider;
        if (provider === "google" || provider === "apple") {
          await writeLastLogin(provider as LastLoginMethod, user?.email ?? undefined);
        }

        stripUrl();
        await enforceInviteOnly();
      } catch {
        setError(t("errors.unexpected"));
        stripUrl();
      } finally {
        setOauthCallbackInFlight(false);
      }
    })();
  }, [translateError, enforceInviteOnly, t]);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError(t("errors.required"));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(translateError(signInError.message));
        return;
      }
      await enforceInviteOnly();
    } catch {
      setError(t("errors.unexpected"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOnboarding = () => {
    if (Platform.OS === "web") {
      globalThis.location.href = onboardingUrl;
    } else {
      Linking.openURL(onboardingUrl).catch(() => {});
    }
  };

  const handleBackToChoose = () => {
    setPhase("choose");
    setError(null);
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
          <View style={styles.logoWrap}>
            <StampeoLogo size={48} color="#000000" />
          </View>

          <View style={styles.card}>
            {oauthCallbackInFlight ? (
              <View style={styles.oauthCallback}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.subtitle}>{t("oauth.connecting")}</Text>
              </View>
            ) : phase === "choose" ? (
              <>
                <View style={styles.heading}>
                  <Text style={styles.title}>{t("title")}</Text>
                  <Text style={styles.subtitle}>{t("subtitle")}</Text>
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <AuthMethodChooser
                  disabled={loading}
                  onChooseEmail={() => {
                    setPhase("credentials");
                    setError(null);
                  }}
                  onSuccess={enforceInviteOnly}
                  onError={(message) => setError(message)}
                />
              </>
            ) : (
              <>
                <View style={styles.headingRow}>
                  <TouchableOpacity
                    onPress={handleBackToChoose}
                    style={styles.backButton}
                    hitSlop={12}
                    accessibilityLabel={t("back")}
                  >
                    <ArrowLeftIcon size={20} color="#6b7280" weight="bold" />
                  </TouchableOpacity>
                  <View style={styles.headingCenter}>
                    <Text style={styles.title}>{t("emailTitle")}</Text>
                    <Text style={styles.subtitle}>{t("emailSubtitle")}</Text>
                  </View>
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

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
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  onPress={handleEmailLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{t("signIn")}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t("signupPrompt")} </Text>
              <TouchableOpacity onPress={handleOpenOnboarding} hitSlop={6}>
                <Text style={styles.footerLink}>{t("getStarted")}</Text>
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 24,
  },
  logoWrap: {
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#faf9f6",
    borderWidth: 1,
    borderColor: "#ddd9d0",
    borderRadius: 24,
    padding: 24,
    gap: 20,
    shadowColor: "#2d3436",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heading: {
    alignItems: "center",
    gap: 6,
  },
  oauthCallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 32,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headingCenter: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    marginRight: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2d3436",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.20)",
    borderRadius: 16,
    padding: 12,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2d3436",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd9d0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#2d3436",
  },
  primaryButton: {
    backgroundColor: "#f97316",
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingTop: 4,
  },
  footerText: {
    fontSize: 13,
    color: "#6b7280",
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#d97706",
  },
});
