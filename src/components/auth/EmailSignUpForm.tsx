import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "phosphor-react-native";
import { useAuth } from "@/contexts/auth-context";
import { classifyAuthError } from "@/lib/auth-errors";
import {
  AuthTextField,
  BlockButton,
  colors,
  radius,
  spacing,
  type,
} from "@/components/auth-ui";

type Step = "details" | "code";

interface EmailSignUpFormProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
  /**
   * They arrived from the join flow with a code already handed over. Changes
   * one line: telling someone to enter a code afterwards, when we are holding
   * it for them, reads as though the last screen did not count.
   */
  codeParked?: boolean;
}

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Create an account with an email and a password, inside the scanner app.
 *
 * Two steps, because the Supabase project has email confirmation switched on:
 * create the account, then verify a six-digit code. The dashboard's invite flow
 * does exactly the same thing; skipping the code would leave the employee with
 * an account that cannot sign in.
 *
 * The password rules mirror the dashboard's rather than inventing a looser set,
 * so an employee cannot pick a password here that the project would reject.
 */
export function EmailSignUpForm({ onSuccess, onSwitchToSignIn, codeParked }: EmailSignUpFormProps) {
  const { t } = useTranslation("login");
  const { signUp, verifySignupOtp, resendSignupOtp } = useAuth();

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const checks = useMemo(
    () => ({
      length: password.length >= 6,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      digit: /[0-9]/.test(password),
      symbol: /[^a-zA-Z0-9]/.test(password),
    }),
    [password]
  );
  const passwordOk = Object.values(checks).every(Boolean);
  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && passwordOk;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleCreate = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const { error: signUpError, alreadyRegistered } = await signUp(
        email.trim(),
        password,
        name.trim()
      );

      if (signUpError) {
        setError(t(`errors.${classifyAuthError(signUpError.message)}` as "errors.generic"));
        return;
      }

      if (alreadyRegistered) {
        // Supabase deliberately does not error on a duplicate address, so this
        // is the only place we can catch it. Send them to sign in instead of
        // waiting for a code that will never arrive.
        setError(t("errors.emailExists"));
        return;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep("code");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, signUp, email, password, name, t]);

  const handleVerify = useCallback(async () => {
    if (otp.trim().length < 6) return;
    setError(null);
    setLoading(true);
    try {
      const { error: verifyError } = await verifySignupOtp(email.trim(), otp.trim());
      if (verifyError) {
        setError(t("errors.otpInvalid"));
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }, [otp, verifySignupOtp, email, t, onSuccess]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setError(null);
    const { error: resendError } = await resendSignupOtp(email.trim());
    if (resendError) {
      setError(t(`errors.${classifyAuthError(resendError.message)}` as "errors.generic"));
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, [cooldown, resendSignupOtp, email, t]);

  if (step === "code") {
    return (
      <View style={styles.container}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t("otp.title")}</Text>
          <Text style={styles.subtitle}>{t("otp.subtitle", { email: email.trim() })}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor={colors.inkFaint}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          editable={!loading}
          accessibilityLabel={t("otp.title")}
        />

        <BlockButton
          variant="primary"
          title={t("otp.verify")}
          onPress={handleVerify}
          loading={loading}
          disabled={loading || otp.length < 6}
        />

        <BlockButton
          variant="quiet"
          title={cooldown > 0 ? t("otp.resendIn", { seconds: cooldown }) : t("otp.resend")}
          onPress={handleResend}
          disabled={cooldown > 0}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>{t("signup.title")}</Text>
        <Text style={styles.subtitle}>
          {t(codeParked ? "signup.subtitleWithCode" : "signup.subtitle")}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <AuthTextField
        label={t("signup.name")}
        placeholder={t("signup.namePlaceholder")}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        editable={!loading}
      />

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

      <View style={styles.field}>
        <AuthTextField
          label={t("password")}
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!loading}
        />
        <View style={styles.checks}>
          {(
            [
              ["length", t("signup.ruleLength")],
              ["lower", t("signup.ruleLower")],
              ["upper", t("signup.ruleUpper")],
              ["digit", t("signup.ruleDigit")],
              ["symbol", t("signup.ruleSymbol")],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={styles.checkRow}>
              <CheckIcon
                size={13}
                weight="bold"
                color={checks[key] ? colors.good : colors.inkFaint}
              />
              <Text style={[styles.checkText, checks[key] && styles.checkTextOk]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <BlockButton
        variant="primary"
        title={t("signup.createAccount")}
        onPress={handleCreate}
        loading={loading}
        disabled={loading || !canSubmit}
      />

      <BlockButton
        variant="quiet"
        title={t("signup.haveAccount")}
        onPress={onSwitchToSignIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: spacing.lg },
  heading: { gap: spacing.sm },
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkSoft },
  field: { gap: spacing.md },
  otpInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.block,
    paddingVertical: spacing.lg,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 12,
    textAlign: "center",
    color: colors.ink,
  },
  checks: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  checkText: { fontSize: 12.5, color: colors.inkFaint },
  checkTextOk: { color: colors.good, fontWeight: "600" },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: radius.block,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
});
