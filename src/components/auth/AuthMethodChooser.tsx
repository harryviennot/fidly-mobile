import { useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, G } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { EnvelopeSimpleIcon } from "phosphor-react-native";
import {
  isGoogleSignInAvailable,
  useAuth,
  type OAuthProvider,
} from "@/contexts/auth-context";
import { classifyAuthError } from "@/lib/auth-errors";
import { useLastLogin } from "@/lib/last-login";
import { BlockButton, colors, spacing } from "@/components/auth-ui";

interface AuthMethodChooserProps {
  disabled?: boolean;
  onChooseEmail: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function AuthMethodChooser({
  disabled,
  onChooseEmail,
  onSuccess,
  onError,
}: AuthMethodChooserProps) {
  const { t } = useTranslation("login");
  const { signInWithProvider } = useAuth();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const lastUsed = useLastLogin()?.method ?? null;

  const handleOAuth = async (provider: OAuthProvider) => {
    setPending(provider);
    try {
      const { error, cancelled } = await signInWithProvider(provider);
      if (cancelled) return;
      if (error) {
        // Don't flatten every failure into "try again": a misconfigured
        // provider can never succeed on a retry, and the employee needs to be
        // pointed at email instead (STA-246).
        const key = classifyAuthError(
          error.message,
          (error as { code?: string }).code
        );
        onError(t(`errors.${key}` as "errors.generic"));
        return;
      }
      onSuccess();
    } finally {
      setPending(null);
    }
  };

  const lastUsedLabel = t("oauth.lastUsed");
  const isDisabled = (p: OAuthProvider | "email") =>
    disabled || (pending !== null && pending !== p);

  return (
    <View style={styles.container}>
      {/* Offering Google on a build without the native module would be a
          button that can only ever fail. Email and Apple are still there. */}
      {isGoogleSignInAvailable ? (
        <BlockButton
          variant="outline"
          onPress={() => handleOAuth("google")}
          disabled={isDisabled("google")}
          loading={pending === "google"}
          icon={<GoogleIcon />}
          title={pending === "google" ? t("oauth.connecting") : t("continueGoogle")}
          badge={lastUsed === "google" ? lastUsedLabel : undefined}
        />
      ) : null}
      <BlockButton
        variant="outline"
        onPress={() => handleOAuth("apple")}
        disabled={isDisabled("apple")}
        loading={pending === "apple"}
        icon={<AppleIcon />}
        title={pending === "apple" ? t("oauth.connecting") : t("continueApple")}
        badge={lastUsed === "apple" ? lastUsedLabel : undefined}
      />
      <BlockButton
        variant="outline"
        onPress={onChooseEmail}
        disabled={isDisabled("email")}
        icon={<EnvelopeSimpleIcon size={22} color={colors.ink} weight="regular" />}
        title={t("continueEmail")}
        badge={lastUsed === "email" ? lastUsedLabel : undefined}
      />
    </View>
  );
}

function AppleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#000"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <G>
        <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: spacing.md,
  },
});
