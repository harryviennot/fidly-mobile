import { useState, type ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Svg, { Path, G } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { CaretRightIcon, EnvelopeSimpleIcon } from "phosphor-react-native";
import { useAuth, type OAuthProvider } from "@/contexts/auth-context";
import { useLastLogin } from "@/lib/last-login";

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
        onError(t("errors.oauthFailed"));
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
      <MethodButton
        onPress={() => handleOAuth("google")}
        disabled={isDisabled("google")}
        loading={pending === "google"}
        loadingLabel={t("oauth.connecting")}
        icon={<GoogleIcon />}
        label={t("continueGoogle")}
        lastUsedLabel={lastUsed === "google" ? lastUsedLabel : undefined}
      />
      <MethodButton
        onPress={() => handleOAuth("apple")}
        disabled={isDisabled("apple")}
        loading={pending === "apple"}
        loadingLabel={t("oauth.connecting")}
        icon={<AppleIcon />}
        label={t("continueApple")}
        lastUsedLabel={lastUsed === "apple" ? lastUsedLabel : undefined}
      />
      <MethodButton
        onPress={onChooseEmail}
        disabled={isDisabled("email")}
        icon={<EnvelopeSimpleIcon size={20} color="#2d3436" weight="regular" />}
        label={t("continueEmail")}
        lastUsedLabel={lastUsed === "email" ? lastUsedLabel : undefined}
      />
    </View>
  );
}

interface MethodButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon: ReactNode;
  label: string;
  lastUsedLabel?: string;
}

function MethodButton({
  onPress,
  disabled,
  loading,
  loadingLabel,
  icon,
  label,
  lastUsedLabel,
}: MethodButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        {loading ? <ActivityIndicator color="#2d3436" /> : icon}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
      {lastUsedLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{lastUsedLabel}</Text>
        </View>
      ) : null}
      <CaretRightIcon size={16} color="#9ca3af" weight="bold" />
    </TouchableOpacity>
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
    gap: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 56,
    paddingHorizontal: 18,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#ddd9d0",
    backgroundColor: "#faf9f6",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#2d3436",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.20)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#d97706",
  },
});
