import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StampeoLogo } from "@/components/ui/StampeoLogo";
import { AuthMethodChooser } from "@/components/auth/AuthMethodChooser";
import { JoinCodeInput } from "./JoinCodeInput";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness } from "@/contexts/business-context";
import { previewJoinCode, redeemJoinCode, type JoinCodePreview } from "@/api/invitations";
import { ApiError } from "@/api/errors";
import {
  JOIN_CODE_LENGTH,
  isValidJoinCode,
  joinErrorKey,
  sanitizeJoinCodeInput,
} from "@/lib/join-code";
import {
  clearPendingJoinCode,
  readPendingJoinCode,
  savePendingJoinCode,
} from "@/lib/pending-join-code";

type Phase = "code" | "auth" | "confirm" | "joining";

interface JoinCodeFlowProps {
  /** Code carried in from the emailed link, if any. */
  initialCode?: string;
  onJoined: (result: {
    businessId: string;
    businessName: string;
    programType: "stamp" | "points" | null;
  }) => void;
  onCancel?: () => void;
}

/**
 * Code -> preview -> (auth) -> redeem.
 *
 * Code first, on purpose. Auth first asks a stranger to create an account with
 * no idea what for; showing "Join Café Lumière?" before the ask is the whole
 * point of handing someone a code across the counter. The cost is that the code
 * has to survive the OAuth round trip, which is what pending-join-code is for.
 */
export function JoinCodeFlow({ initialCode, onJoined, onCancel }: JoinCodeFlowProps) {
  const router = useRouter();
  const { t } = useTranslation("join");
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuth();
  const { refreshMemberships, selectBusiness } = useBusiness();

  const [phase, setPhase] = useState<Phase>("code");
  const [code, setCode] = useState(() => sanitizeJoinCodeInput(initialCode ?? ""));
  const [preview, setPreview] = useState<JoinCodePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showError = useCallback(
    (err: unknown) => {
      const apiError = err instanceof ApiError ? err : null;
      setError(t(joinErrorKey(apiError?.code) as "errors.GENERIC"));
    },
    [t]
  );

  /** Look the code up. Needs a session, so signed-out users detour via auth. */
  const lookup = useCallback(
    async (candidate: string) => {
      if (!isValidJoinCode(candidate)) return;
      setError(null);

      if (!user) {
        // Park the code so it survives an OAuth cold launch, then sign in.
        await savePendingJoinCode(candidate);
        setPhase("auth");
        return;
      }

      setBusy(true);
      try {
        const result = await previewJoinCode(candidate);
        setPreview(result);
        setPhase("confirm");
      } catch (err) {
        showError(err);
        setPhase("code");
      } finally {
        setBusy(false);
      }
    },
    [user, showError]
  );

  // A code arrived in the link: look it up straight away rather than showing
  // the employee a pre-filled field and asking them to press a button.
  const autoLookedUp = useRef(false);
  useEffect(() => {
    if (autoLookedUp.current) return;
    const seeded = sanitizeJoinCodeInput(initialCode ?? "");
    if (!isValidJoinCode(seeded)) return;
    autoLookedUp.current = true;
    void lookup(seeded);
    // `lookup` is recreated when the session lands, which is exactly when the
    // parked-code effect below takes over; re-running here would double-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  // Coming back from the sign-in detour: pick the parked code up and continue
  // where the employee left off, rather than making them retype it.
  useEffect(() => {
    if (!user || phase === "confirm" || phase === "joining") return;
    let active = true;

    (async () => {
      const pending = await readPendingJoinCode();
      if (!active || !pending) return;
      setCode(pending);
      await lookup(pending);
    })();

    return () => {
      active = false;
    };
    // `lookup` is stable per user; re-running on every keystroke would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleJoin = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPhase("joining");
    try {
      const result = await redeemJoinCode(code);
      await clearPendingJoinCode();
      await refreshMemberships();
      selectBusiness(result.business_id);
      onJoined({
        businessId: result.business_id,
        businessName: result.business_name,
        programType: result.program_type,
      });
    } catch (err) {
      showError(err);
      setPhase("confirm");
    } finally {
      setBusy(false);
    }
  }, [code, refreshMemberships, selectBusiness, onJoined, showError]);

  const handleReset = useCallback(() => {
    setPreview(null);
    setCode("");
    setError(null);
    setPhase("code");
    void clearPendingJoinCode();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <StampeoLogo size={48} color="#000000" />

        {phase === "code" && (
          <View style={styles.block}>
            <Text style={styles.title}>{t("codeTitle")}</Text>
            <Text style={styles.subtitle}>{t("codeSubtitle")}</Text>

            <JoinCodeInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (error) setError(null);
              }}
              onComplete={lookup}
              disabled={busy}
              hasError={!!error}
            />

            <Text style={styles.helper}>{t("codeHelper")}</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (code.length < JOIN_CODE_LENGTH || busy) && styles.buttonDisabled,
              ]}
              onPress={() => lookup(code)}
              disabled={code.length < JOIN_CODE_LENGTH || busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{t("codeSubmit")}</Text>
              )}
            </TouchableOpacity>

            {onCancel && (
              <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
                <Text style={styles.secondaryButtonText}>{tCommon("cancel")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {phase === "auth" && (
          <View style={styles.block}>
            <Text style={styles.title}>{t("authTitle")}</Text>
            <Text style={styles.subtitle}>{t("authSubtitle")}</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <AuthMethodChooser
              // Email sign-in lives on the login screen, not here. The code is
              // already parked in storage, so signing in there bounces a
              // memberless user straight back to /join and the pending-code
              // effect resumes where they left off.
              onChooseEmail={() => router.push("/(auth)/login")}
              onSuccess={() => {
                // The pending-code effect above takes it from here once the
                // session lands.
              }}
              onError={setError}
            />

            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>{tCommon("goBack")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {(phase === "confirm" || phase === "joining") && preview && (
          <View style={styles.block}>
            {preview.business_logo_url ? (
              <Image
                source={preview.business_logo_url}
                style={styles.logo}
                contentFit="contain"
              />
            ) : null}

            <Text style={styles.title}>
              {t("confirmTitle", { business: preview.business_name })}
            </Text>
            <Text style={styles.subtitle}>{t("confirmRole")}</Text>
            <Text style={styles.helper}>
              {t("confirmInvitedBy", { inviter: preview.inviter_name })}
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
              onPress={handleJoin}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{t("confirmSubmit")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleReset}
              disabled={busy}
            >
              <Text style={styles.secondaryButtonText}>{t("confirmCancel")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0efe9",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 28,
  },
  block: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2d3436",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
  helper: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    color: "#dc2626",
    textAlign: "center",
    lineHeight: 20,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#f97316",
    borderRadius: 9999,
    padding: 16,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2d3436",
    fontSize: 15,
    fontWeight: "500",
  },
});
