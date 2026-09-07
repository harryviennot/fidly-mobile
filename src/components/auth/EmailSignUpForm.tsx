import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "phosphor-react-native";
import { useAuth } from "@/contexts/auth-context";
import { classifyAuthError } from "@/lib/auth-errors";

type Step = "details" | "code";

interface EmailSignUpFormProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
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
export function EmailSignUpForm({ onSuccess, onSwitchToSignIn }: EmailSignUpFormProps) {
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
          placeholderTextColor="#c9c3b6"
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.primaryButton, (loading || otp.length < 6) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || otp.length < 6}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{t("otp.verify")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={cooldown > 0} style={styles.linkButton}>
          <Text style={[styles.link, cooldown > 0 && styles.linkMuted]}>
            {cooldown > 0 ? t("otp.resendIn", { seconds: cooldown }) : t("otp.resend")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>{t("signup.title")}</Text>
        <Text style={styles.subtitle}>{t("signup.subtitle")}</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>{t("signup.name")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("signup.namePlaceholder")}
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          editable={!loading}
        />
      </View>

      <View style={styles.field}>
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

      <View style={styles.field}>
        <Text style={styles.label}>{t("password")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("passwordPlaceholder")}
          placeholderTextColor="#9ca3af"
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
                size={12}
                weight="bold"
                color={checks[key] ? "#1d6b45" : "#c9c3b6"}
              />
              <Text style={[styles.checkText, checks[key] && styles.checkTextOk]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (loading || !canSubmit) && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading || !canSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>{t("signup.createAccount")}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchToSignIn} style={styles.linkButton}>
        <Text style={styles.link}>{t("signup.haveAccount")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: 14 },
  heading: { gap: 6, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#2d3436", textAlign: "center" },
  subtitle: { fontSize: 15, color: "#6b7280", textAlign: "center", lineHeight: 21 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#2d3436" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd9d0",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2d3436",
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: "#ddd9d0",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
    color: "#2d3436",
  },
  checks: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  checkText: { fontSize: 12, color: "#9ca3af" },
  checkTextOk: { color: "#1d6b45" },
  primaryButton: {
    backgroundColor: "#f97316",
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  linkButton: { paddingVertical: 10, alignItems: "center" },
  link: { fontSize: 14, fontWeight: "500", color: "#2d3436", textDecorationLine: "underline" },
  linkMuted: { color: "#9ca3af", textDecorationLine: "none" },
  errorBox: {
    backgroundColor: "#f6e3df",
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: "#a8321f", fontSize: 14, lineHeight: 20 },
});
