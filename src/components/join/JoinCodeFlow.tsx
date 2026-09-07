import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { AuthMethodChooser } from "@/components/auth/AuthMethodChooser";
import {
  AuthScreen,
  BlockButton,
  colors,
  radius,
  spacing,
  type,
} from "@/components/auth-ui";
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
  /**
   * Extra links under the actions. The signed-in memberless case uses this for
   * its way out (create a business, or sign out), since it has no cancel.
   */
  footer?: ReactNode;
}

/**
 * Code -> preview -> (auth) -> redeem.
 *
 * Code first, on purpose. Auth first asks a stranger to create an account with
 * no idea what for; showing "Join Café Lumière?" before the ask is the whole
 * point of handing someone a code across the counter. The cost is that the code
 * has to survive the OAuth round trip, which is what pending-join-code is for.
 */
export function JoinCodeFlow({
  initialCode,
  onJoined,
  onCancel,
  footer,
}: JoinCodeFlowProps) {
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

  if (phase === "auth") {
    return (
      <AuthScreen
        title={t("authTitle")}
        subtitle={t("authSubtitle")}
        error={error}
        onBack={handleReset}
        backLabel={tCommon("goBack")}
        footer={footer}
      >
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
      </AuthScreen>
    );
  }

  if ((phase === "confirm" || phase === "joining") && preview) {
    return (
      <AuthScreen
        title={t("confirmTitle", { business: preview.business_name })}
        subtitle={t("confirmRole")}
        error={error}
        onBack={busy ? undefined : handleReset}
        backLabel={t("confirmCancel")}
        footer={footer}
        body={
          <View style={styles.identity}>
            {preview.business_logo_url ? (
              <Image
                source={preview.business_logo_url}
                style={styles.logo}
                contentFit="contain"
              />
            ) : null}
            <Text style={styles.invitedBy}>
              {t("confirmInvitedBy", { inviter: preview.inviter_name })}
            </Text>
          </View>
        }
      >
        <BlockButton
          variant="primary"
          title={busy ? t("joining") : t("confirmSubmit")}
          onPress={handleJoin}
          loading={busy}
          disabled={busy}
        />
        <BlockButton
          variant="quiet"
          title={t("confirmCancel")}
          onPress={handleReset}
          disabled={busy}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={t("codeTitle")}
      subtitle={t("codeSubtitle")}
      error={error}
      footer={footer}
      body={
        <>
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
        </>
      }
    >
      <BlockButton
        variant="primary"
        title={t("codeSubmit")}
        onPress={() => lookup(code)}
        loading={busy}
        disabled={code.length < JOIN_CODE_LENGTH || busy}
      />

      {onCancel ? (
        <BlockButton variant="quiet" title={tCommon("cancel")} onPress={onCancel} />
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: radius.block,
    backgroundColor: colors.surface,
  },
  invitedBy: {
    ...type.body,
    color: colors.inkSoft,
    flex: 1,
  },
  helper: {
    ...type.body,
    color: colors.inkFaint,
  },
});
