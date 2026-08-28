import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Prohibit } from "phosphor-react-native";
import { useAlert } from "@/contexts/alert-context";
import { useBusiness } from "@/contexts/business-context";
import type { EarningCapSnapshot } from "@/types/api";
import { PressableScale } from "@/components/PressableScale";
import { ConfirmationScaffold } from "./ConfirmationScaffold";
import { ACTION_ENTER, BODY_ENTER, DETAIL_ENTER, ICON_ENTER, SOFT_ENTER } from "./animations";
import { UNLOCK_AMBER, UNLOCK_TINT } from "./palette";

interface CapBlockedScreenProps {
  customerName: string;
  cap: Pick<EarningCapSnapshot, "scope" | "limit">;
  /**
   * The server's verdict, from a 409 payload. Undefined on the pre-scan path,
   * where no request has been made yet and there is no server opinion to honor.
   * `false` hides the button; the local role still has to agree either way, and
   * the backend re-checks the role on the request itself.
   */
  serverAllowsOverride?: boolean;
  /** Called after the manager confirms the override. */
  onOverride: () => void;
  /**
   * True while the override is sending the scan straight through (the block
   * came from a rejected request, so there is nothing to go back and re-press).
   */
  overriding?: boolean;
  /** Failure from that send, kept on this screen so the decision can be retried. */
  errorMessage?: string | null;
  onDone: () => void;
  /** Redeeming is not earning, so a banked reward stays claimable here. */
  renderRedeemButton?: () => React.ReactNode;
}

/**
 * "This customer has hit their limit" — the state this whole feature exists to
 * make visible. Modelled on the reward-ready screen: it replaces the controls
 * rather than letting the employee press a button that will fail.
 *
 * A manager can wave the customer through; a regular employee is told who can.
 * The button is a convenience, not the security boundary: the backend re-checks
 * the role and 403s a scanner-role override.
 */
export function CapBlockedScreen({
  customerName,
  cap,
  serverAllowsOverride,
  onOverride,
  overriding = false,
  errorMessage,
  onDone,
  renderRedeemButton,
}: CapBlockedScreenProps) {
  const { t } = useTranslation("stamp");
  const { currentMembership } = useBusiness();
  const { alert } = useAlert();

  const isDay = cap.scope === "day";
  const role = currentMembership?.role;
  // Two gates, and the button is the weaker one: it only decides whether to
  // OFFER the override. The backend re-checks the role on the request and 403s
  // a scanner-role attempt, so a stale membership here cannot grant anything.
  const isManager = role === "owner" || role === "admin";
  const mayOverride = serverAllowsOverride !== false && isManager;

  const confirmOverride = () => {
    if (overriding) return;
    alert(t("cap.overrideConfirmTitle"), t("cap.overrideConfirmMessage"), [
      { text: t("cap.overrideCancel"), style: "cancel" },
      { text: t("cap.overrideConfirm"), onPress: onOverride },
    ]);
  };

  return (
    <ConfirmationScaffold>
      <View style={styles.root}>
        <View style={styles.header}>
          <Animated.View entering={ICON_ENTER} style={[styles.icon, { backgroundColor: UNLOCK_TINT }]}>
            <Prohibit size={36} color={UNLOCK_AMBER} weight="bold" />
          </Animated.View>
          <Animated.View entering={BODY_ENTER}>
            <Text style={styles.title}>
              {isDay ? t("cap.blockedTitleDay") : t("cap.blockedTitleWeek")}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {customerName}
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={DETAIL_ENTER} style={styles.body}>
          <Text style={styles.explain}>
            {isDay
              ? t("cap.blockedMessageDay", { limit: cap.limit })
              : t("cap.blockedMessageWeek", { limit: cap.limit })}
          </Text>
          <Text style={styles.hint}>
            {mayOverride ? t("cap.overrideHint") : t("cap.contactManager")}
          </Text>
        </Animated.View>

        {errorMessage && (
          <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{errorMessage}</Text>
          </Animated.View>
        )}

        <Animated.View entering={ACTION_ENTER} style={styles.actions}>
          {renderRedeemButton?.()}
          {mayOverride && (
            <PressableScale
              style={[styles.overrideButton, overriding && styles.overrideBusy]}
              onPress={confirmOverride}
              disabled={overriding}
            >
              {overriding ? (
                <ActivityIndicator color={UNLOCK_AMBER} />
              ) : (
                <Text style={styles.overrideText}>{t("cap.overrideButton")}</Text>
              )}
            </PressableScale>
          )}
          {/* The way out is the safe answer, so it gets a real button rather
              than a grey line of text — especially now that "Add anyway"
              commits the scan on the spot. */}
          <PressableScale style={styles.doneButton} onPress={onDone} disabled={overriding}>
            <Text style={styles.doneText}>{t("cap.done")}</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </ConfirmationScaffold>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between", paddingVertical: 8 },
  header: { alignItems: "center", gap: 14, paddingTop: 8 },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#1A1A1A", textAlign: "center" },
  name: { fontSize: 15, color: "#6B7280", textAlign: "center", marginTop: 4 },
  body: { paddingHorizontal: 24, gap: 10 },
  explain: { fontSize: 15, lineHeight: 22, color: "#374151", textAlign: "center" },
  hint: { fontSize: 13, lineHeight: 19, color: "#9CA3AF", textAlign: "center" },
  actions: { gap: 12, paddingHorizontal: 4 },
  overrideButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: UNLOCK_AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  overrideBusy: { opacity: 0.7 },
  overrideText: { fontSize: 16, fontWeight: "600", color: UNLOCK_AMBER },
  doneButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  inlineError: {
    marginHorizontal: 4,
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 10,
  },
  inlineErrorText: { color: "#dc2626", textAlign: "center" },
});
