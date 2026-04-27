import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useAuth, type OAuthProvider } from "@/contexts/auth-context";

interface OAuthButtonsProps {
  disabled?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function OAuthButtons({ disabled, onSuccess, onError }: OAuthButtonsProps) {
  const { t } = useTranslation("login");
  const { signInWithProvider } = useAuth();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const handle = async (provider: OAuthProvider) => {
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

  const buttonDisabled = (p: OAuthProvider) =>
    disabled || (pending !== null && pending !== p);

  return (
    <View style={styles.container}>
      {Platform.OS === "ios" && (
        <TouchableOpacity
          style={[styles.button, styles.appleButton, buttonDisabled("apple") && styles.buttonDisabled]}
          onPress={() => handle("apple")}
          disabled={buttonDisabled("apple")}
        >
          {pending === "apple" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <AppleIcon />
              <Text style={styles.appleButtonText}>{t("oauth.apple")}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, styles.googleButton, buttonDisabled("google") && styles.buttonDisabled]}
        onPress={() => handle("google")}
        disabled={buttonDisabled("google")}
      >
        {pending === "google" ? (
          <ActivityIndicator color="#2d3436" />
        ) : (
          <>
            <GoogleIcon />
            <Text style={styles.googleButtonText}>{t("oauth.google")}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function OAuthDivider() {
  const { t } = useTranslation("login");
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.text}>{t("oauth.divider")}</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
    justifyContent: "center",
    gap: 8,
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  appleButton: {
    backgroundColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd9d0",
  },
  googleButtonText: {
    color: "#2d3436",
    fontSize: 16,
    fontWeight: "600",
  },
});

const dividerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd9d0",
  },
  text: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
});
