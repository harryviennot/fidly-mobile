import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/auth-context";
import { AuthMethodChooser } from "@/components/auth/AuthMethodChooser";
import { EmailSignUpForm } from "@/components/auth/EmailSignUpForm";
import { CreateBusinessSheet } from "@/components/auth/CreateBusinessSheet";
import {
  AuthScreen,
  AuthTextField,
  BlockButton,
  colors,
  spacing,
  type,
} from "@/components/auth-ui";
import { supabase } from "@/lib/supabase";
import { writeLastLogin, type LastLoginMethod } from "@/lib/last-login";
import { getUserMemberships } from "@/api/memberships";
import { classifyAuthError } from "@/lib/auth-errors";

type Phase = "choose" | "credentials" | "signup";

export default function LoginScreen() {
  const { t } = useTranslation("login");
  const { t: tWelcome } = useTranslation("welcome");
  const router = useRouter();
  const { signIn } = useAuth();
  const [phase, setPhase] = useState<Phase>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [businessSheetOpen, setBusinessSheetOpen] = useState(false);
  const [oauthCallbackInFlight, setOauthCallbackInFlight] = useState(
    () =>
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      /[?&](code|error)=/.test(window.location.search)
  );
  const oauthHandledRef = useRef(false);

  // Translate raw Supabase error messages into friendly, localised copy.
  // The classification itself lives in a pure module so the OAuth path in
  // AuthMethodChooser uses exactly the same rules (STA-246: it used to have
  // none, and flattened every provider failure into "try again").
  const translateError = useCallback(
    (message: string, code?: string) =>
      t(`errors.${classifyAuthError(message, code)}` as "errors.generic"),
    [t]
  );

  // After ANY successful auth, ensure the user has at least one membership.
  // Scanner-app is still invite-only, but a memberless user is no longer signed
  // back out: they keep the session and land on the join screen, one field away
  // from being in (STA-246). Signing them out was the dead end that made a
  // *successful* Google sign-in look like a failed one.
  const enforceInviteOnly = useCallback(async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    try {
      const memberships = await getUserMemberships(user.id);
      if (memberships.length === 0) {
        router.replace("/join");
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

  // Back goes one phase at a time, and out to the welcome screen from the
  // first: this screen is pushed from there, so leaving it must feel like
  // stepping back rather than landing somewhere new.
  const handleBack = () => {
    setError(null);
    if (phase === "choose") {
      router.back();
      return;
    }
    setPhase("choose");
  };

  if (oauthCallbackInFlight) {
    return (
      <AuthScreen>
        <View style={styles.connecting}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.connectingText}>{t("oauth.connecting")}</Text>
        </View>
      </AuthScreen>
    );
  }

  // Deliberately NOT "Get started": next to "Create an account" (which makes an
  // employee account right here) a second vague CTA is how someone ends up
  // owning an empty business by accident. This one names the audience.
  const businessFooter = (
    <BlockButton
      variant="quiet"
      title={tWelcome("businessLink")}
      onPress={() => setBusinessSheetOpen(true)}
    />
  );

  return (
    <>
      {phase === "choose" ? (
        <AuthScreen
          title={t("title")}
          subtitle={t("subtitle")}
          onBack={handleBack}
          backLabel={t("back")}
          error={error}
          footer={businessFooter}
        >
          <AuthMethodChooser
            disabled={loading}
            onChooseEmail={() => {
              setPhase("credentials");
              setError(null);
            }}
            onSuccess={enforceInviteOnly}
            onError={(message) => setError(message)}
          />
        </AuthScreen>
      ) : phase === "signup" ? (
        <AuthScreen
          onBack={handleBack}
          backLabel={t("back")}
          // The form carries its own heading and actions for both of its
          // steps, so it goes in the body slot as one block rather than being
          // split across the frame's head and actions.
          body={
            <EmailSignUpForm
              // A brand-new employee has no memberships, so this lands them
              // on the join screen with the code still to enter.
              onSuccess={enforceInviteOnly}
              onSwitchToSignIn={() => {
                setPhase("credentials");
                setError(null);
              }}
            />
          }
        />
      ) : (
        <AuthScreen
          title={t("emailTitle")}
          subtitle={t("emailSubtitle")}
          onBack={handleBack}
          backLabel={t("back")}
          error={error}
          footer={businessFooter}
          body={
            <View style={styles.fields}>
              <AuthTextField
                label={t("email")}
                placeholder={t("emailPlaceholder")}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
              <AuthTextField
                label={t("password")}
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                editable={!loading}
              />
            </View>
          }
        >
          <BlockButton
            variant="primary"
            title={t("signIn")}
            onPress={handleEmailLogin}
            loading={loading}
            disabled={loading}
          />
          <BlockButton
            variant="quiet"
            title={t("signupCta")}
            onPress={() => {
              setPhase("signup");
              setError(null);
            }}
          />
        </AuthScreen>
      )}

      <CreateBusinessSheet
        visible={businessSheetOpen}
        onClose={() => setBusinessSheetOpen(false)}
        onUseCode={() => router.push("/join")}
      />
    </>
  );
}

const styles = StyleSheet.create({
  connecting: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  connectingText: {
    ...type.body,
    color: colors.inkSoft,
  },
  fields: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
});
