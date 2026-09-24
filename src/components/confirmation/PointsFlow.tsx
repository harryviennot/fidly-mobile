import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { CaretRight, Check, Confetti, Gift, PauseCircle } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { addPoints } from "@/api/points";
import { getCustomer, redeemReward } from "@/api/customers";
import { classifyMutationFailure, redeemErrorKey } from "@/utils/apiErrors";
import {
  claimClientKey,
  releaseClientKey,
  scanFingerprint,
  type ClientKeyLedger,
} from "@/api/idempotency";
import { mintClientKey } from "@/lib/client-key";
import {
  SLOW_HINT_AFTER_MS,
  hintKeyForPhase,
  reconcileVerdict,
  recoveryErrorKey,
  type ReconcileTarget,
  type ScanPhase,
} from "@/utils/scanRecovery";
import { markScanCompleted } from "@/lib/app-rating";
import { useLocation } from "@/contexts/location-context";
import { useTheme } from "@/contexts/theme-context";
import type { BankedReward, Customer, ProgramReward, StampResponse } from "@/types/api";
import {
  applyKeypadInput,
  getCurrencySymbol,
  getDecimalSeparator,
  parseAmount,
} from "@/utils/money";
import { formatThreshold, previewBoost } from "@/utils/boost";
import { resolveWaiveAction } from "@/utils/cap";
import { selectPluralForm } from "@/utils/plural";
import { Keypad } from "@/components/Keypad";
import { PressableScale } from "@/components/PressableScale";
import { ConfirmationScaffold } from "./ConfirmationScaffold";
import { StatusScreen } from "./StatusScreen";
import { CapBlockedScreen } from "./CapBlockedScreen";
import { CustomerHeader } from "./CustomerHeader";
import { AmountDisplay } from "./AmountDisplay";
import { AnimatedBalance } from "./AnimatedBalance";
import { PointsProgress } from "./PointsProgress";
import { RewardsMenu } from "./RewardsMenu";
import { ACTION_ENTER, BODY_ENTER, DETAIL_ENTER, ICON_ENTER, SOFT_ENTER } from "./animations";
import { SUCCESS_GREEN, SUCCESS_TINT, UNLOCK_AMBER, UNLOCK_TINT } from "./palette";

interface PointsFlowProps {
  /** May be null while the fetch is in flight — the keypad renders immediately. */
  customer: Customer | null;
  loading: boolean;
  setCustomer: Dispatch<SetStateAction<Customer | null>>;
  businessId: string;
  enrollmentId: string;
  /** Active-design rate fallback for the live preview before the snapshot lands. */
  fallbackRate: number | null;
}

const valueOf = (r: StampResponse) => r.value_after ?? r.stamps;

/** Smallest reward threshold strictly above `value`, with its name. */
function nextReward(ladder: ProgramReward[], value: number): ProgramReward | null {
  return (
    [...ladder].filter((r) => r.threshold > value).sort((a, b) => a.threshold - b.threshold)[0] ??
    null
  );
}

/**
 * Points-program confirmation flow, keypad-first: the keypad is live the moment
 * the screen opens (program type comes from the cached design), while the
 * customer name + balance populate in parallel. Enter the ticket price → one tap
 * adds points; a "rewards available" chip opens the redeem picker.
 */
export function PointsFlow({
  customer,
  loading,
  setCustomer,
  businessId,
  enrollmentId,
  fallbackRate,
}: PointsFlowProps) {
  const { t, i18n } = useTranslation("points");
  const { t: tStamp } = useTranslation("stamp");
  const { t: tCommon } = useTranslation("common");
  const { t: tLocation } = useTranslation("location");
  const { selectedLocation } = useLocation();
  const { theme } = useTheme();

  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);
  // Which HELD reward is mid-redeem (separate from the menu spinner).
  const [redeemingHeldId, setRedeemingHeldId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPausedError, setIsPausedError] = useState(false);
  const [addResult, setAddResult] = useState<StampResponse | null>(null);
  const [redeemResult, setRedeemResult] = useState<StampResponse | null>(null);
  const [balanceBeforeAdd, setBalanceBeforeAdd] = useState(0);
  const [balanceBeforeRedeem, setBalanceBeforeRedeem] = useState(0);
  const [redeemedRewardName, setRedeemedRewardName] = useState<string | null>(null);
  const [rewardsMenuOpen, setRewardsMenuOpen] = useState(false);
  // How far along the request in flight is: drives the hint line and locks the
  // way out of the screen. See utils/scanRecovery.
  const [phase, setPhase] = useState<ScanPhase>("idle");
  // The last attempt failed in a way a second tap could fix, so the CTA says
  // Retry. A coded gate never sets this: pressing again gets the same answer.
  const [retryable, setRetryable] = useState(false);
  // Credited by a request we never heard back from: same layout, different
  // title, one haptic.
  const [alreadyCounted, setAlreadyCounted] = useState(false);
  /** The idempotency key per request body, for the life of this screen. */
  const clientKeys = useRef<ClientKeyLedger>({});

  const program = customer?.program ?? null;
  const ladder = useMemo(() => program?.rewards ?? [], [program]);
  // Rewards already earned or gifted, claimable regardless of balance.
  const heldRewards: BankedReward[] = useMemo(
    () => program?.banked_rewards ?? [],
    [program]
  );
  const rate = program?.points_per_currency_unit ?? fallbackRate ?? null;
  const separator = getDecimalSeparator();
  const currency = getCurrencySymbol();

  const parsedAmount = parseAmount(amount, separator);
  // Basket boosters change what this ticket is worth, so the keypad previews
  // the boosted total (and names the threshold still to come) rather than a
  // base figure the scan would immediately contradict.
  const boostTiers = program?.basket_boost?.tiers ?? null;
  const boostPreview = previewBoost(parsedAmount, rate, boostTiers);
  const pointsPreview = rate != null ? boostPreview.total : null;

  // Live balance: after an action use its result, else the snapshot.
  const balance = redeemResult ? valueOf(redeemResult) : addResult ? valueOf(addResult) : program?.primary_value ?? 0;
  const affordableCount = ladder.filter((r) => r.threshold <= balance).length;
  // A held reward makes the menu worth opening even at a zero balance: the
  // customer owns it outright, so affordability has nothing to say about it.
  const redeemableCount = affordableCount + heldRewards.length;
  const rewardReady = redeemableCount > 0;

  // The add CTA fades between enabled/disabled instead of jumping. Gated on
  // the customer snapshot having arrived: the keypad opens optimistically from
  // the cached design type, and if the program was converted underneath the
  // cache the dispatcher reroutes on load — submitting before that would let a
  // ticket price silently land as +1 stamp on a now-stamp program.
  // Manager decided to push this customer past their earning limit. Lives for
  // one scan; the request carries it and the server re-checks the role.
  const [capOverride, setCapOverride] = useState(false);
  // Cap standing the LAST request reported, when it beat the snapshot.
  const [capError, setCapError] = useState<{
    scope: "day" | "week";
    limit: number;
    resets_at: string;
    can_override?: boolean;
  } | null>(null);
  const earningCap = program?.earning_cap ?? null;
  // What this ticket would credit vs what the limit still allows.
  const capRemaining = capOverride ? null : earningCap?.remaining ?? null;
  const willClamp =
    capRemaining !== null &&
    capRemaining > 0 &&
    pointsPreview != null &&
    pointsPreview > capRemaining;

  const canAdd = parsedAmount > 0 && !loading;
  const addOpacity = useSharedValue(canAdd ? 1 : 0.4);
  useEffect(() => {
    addOpacity.value = withTiming(canAdd ? 1 : 0.4, { duration: 160 });
  }, [canAdd, addOpacity]);
  const addOpacityStyle = useAnimatedStyle(() => ({ opacity: addOpacity.value }));

  // Anything in flight: the spinner is up and the ways off this screen are
  // locked. Backing out mid-request and rescanning would mint a NEW key, which
  // is the one double-credit the idempotency key cannot close.
  const inFlight = phase !== "idle";
  const hintKey = hintKeyForPhase(phase);

  // A request that has not answered in three seconds gets a quiet line saying
  // so, in a slot that is always reserved so nothing moves.
  useEffect(() => {
    if (phase !== "submitting") return;
    const timer = setTimeout(
      () => setPhase((current) => (current === "submitting" ? "slow" : current)),
      SLOW_HINT_AFTER_MS
    );
    return () => clearTimeout(timer);
  }, [phase]);

  function handleKey(key: string) {
    setAmount((a) => applyKeypadInput(a, key, separator));
    // A different ticket is a different request, so the CTA stops offering to
    // retry the old one. The banner stays: what happened is still worth
    // reading.
    setRetryable(false);
  }

  /** The one tap a reconciled success is allowed. */
  async function acknowledge() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  /**
   * Go and find out what happened: exactly ONE read, never a re-send. Null
   * means even the read failed, which is a different screen from a read that
   * came back saying nothing moved.
   */
  async function reconcile(): Promise<Customer | null> {
    setPhase("confirming");
    try {
      return await getCustomer(businessId, enrollmentId);
    } catch {
      return null;
    }
  }

  function syncBalance(newValue: number) {
    setCustomer((prev) =>
      prev && prev.program
        ? { ...prev, stamps: newValue, program: { ...prev.program, primary_value: newValue } }
        : prev
    );
  }

  function mapActionError(err: unknown, fallbackKey: "errors.addFailed" | "errors.redeemFailed") {
    const code = (err as any)?.code;
    if (code === "MEMBER_PAUSED") {
      setIsPausedError(true);
    } else if (code === "EARNING_CAP_REACHED") {
      // The snapshot said there was room, but another device used it first.
      const detail = (err as any)?.detail ?? {};
      setCapError({
        scope: detail.scope === "week" ? "week" : "day",
        limit: detail.limit ?? 0,
        resets_at: detail.resets_at ?? "",
        can_override: detail.can_override ?? false,
      });
    } else if (code === "CAP_OVERRIDE_NOT_ALLOWED") {
      setCapOverride(false);
      setError(tStamp("cap.overrideNotAllowed"));
    } else if (code === "CHECKOUT_REQUIRED") {
      setError(tStamp("errors.checkoutRequired"));
    } else if (code === "BILLING_REQUIRED") {
      setError(tStamp("errors.billingRequired"));
    } else if (code === "ACCESS_DENIED") {
      setError(tStamp("errors.accessDenied"));
    } else if (code === "AMOUNT_REQUIRED") {
      setError(t("errors.amountRequired"));
    } else if (code === "LOCATION_NOT_PERMITTED") {
      setError(tLocation("errors.notPermitted"));
    } else if (code === "LOCATION_REQUIRED" || code === "LOCATION_NOT_FOUND") {
      setError(tLocation("errors.locationRequired"));
    } else {
      // Never the server's own words — see StampFlow. An unmapped code falls
      // through to this screen's own fallback.
      const mapped = redeemErrorKey(err);
      setError(
        mapped === "errors.redeemFailed" ? t(fallbackKey) : tStamp(mapped as never)
      );
    }
  }

  /**
   * `overrideNow` is the manager's just-made decision, passed explicitly because
   * the `capOverride` state it also sets is not readable until the next render.
   */
  async function handleAdd(overrideNow?: boolean) {
    if (adding || !(parsedAmount > 0)) return;
    const override = overrideNow ?? capOverride;
    // The key is filed under this exact request. Retry re-sends the same body
    // and the same key; a different ticket price, or a waived cap, is a
    // different request and mints its own.
    const fingerprint = scanFingerprint({
      action: "points",
      businessId,
      enrollmentId,
      locationId: selectedLocation?.id ?? null,
      amount: parsedAmount,
      capOverride: override,
    });
    const claim = claimClientKey(clientKeys.current, fingerprint, mintClientKey);
    clientKeys.current = claim.ledger;
    const balanceBefore = program?.primary_value ?? 0;
    const before: ReconcileTarget = { action: "points", balance: balanceBefore };

    try {
      setAdding(true);
      setPhase("submitting");
      setError(null);
      setRetryable(false);
      // This attempt is its own: a previous one having been merely confirmed
      // must not put "already counted" on top of a fresh success.
      setAlreadyCounted(false);
      setBalanceBeforeAdd(balanceBefore);
      const result = await addPoints(
        businessId,
        enrollmentId,
        parsedAmount,
        selectedLocation?.id,
        override,
        claim.key
      );
      // Settled: from here an identical ticket is a second deliberate scan.
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      const after = valueOf(result);
      setAddResult(result);
      syncBalance(after);
      if (result.replayed) {
        // Our own request, answered twice. The points landed the first time,
        // which is also when the customer's banner and celebration ran.
        setAlreadyCounted(true);
        await acknowledge();
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // A heavier second tap when this scan unlocked a reward.
        const crossed = ladder.some(
          (r) => balanceBefore < r.threshold && r.threshold <= after
        );
        if (crossed) {
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          }, 130);
        }
      }
      markScanCompleted();
    } catch (err) {
      await handleAddFailure(err, before, fingerprint);
    } finally {
      setAdding(false);
      setPhase("idle");
    }
  }

  /**
   * What a failed add means, and which recovery it gets.
   *
   * The coded gates fall through to `mapActionError`, untouched by STA-340:
   * the backend refused on purpose and the keypad already explains why.
   */
  async function handleAddFailure(
    err: unknown,
    before: ReconcileTarget,
    fingerprint: string
  ) {
    const failure = classifyMutationFailure(err);

    if (failure === "timeout") {
      const fresh = await reconcile();
      const verdict = reconcileVerdict(before, fresh);
      if (verdict === "credited" && fresh) {
        clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
        setCustomer(fresh);
        const after = fresh.program?.primary_value ?? fresh.stamps;
        setAddResult({
          customer_id: fresh.id,
          name: fresh.name,
          stamps: after,
          value_after: after,
          message: "",
        });
        setAlreadyCounted(true);
        await acknowledge();
        markScanCompleted();
        return;
      }
      setError(tStamp(recoveryErrorKey(verdict) as never));
      setRetryable(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "offline") {
      setError(tStamp("errors.offline"));
      setRetryable(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "conflict") {
      // A bug of ours: this key is held by a different request. Drop it rather
      // than retry into a 409 forever.
      console.warn("[Scan] client_key conflict on points, dropping the key");
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      setError(t("errors.addFailed"));
      setRetryable(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    mapActionError(err, "errors.addFailed");
    if (failure === "server") setRetryable(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  /**
   * Manager waives the limit. When the block came from a rejected request the
   * amount is still on screen and already confirmed, so send it straight
   * through — the alternative is dropping them back on the keypad to press
   * "Add points" a second time on an amount they never changed.
   */
  async function handleWaive() {
    setCapOverride(true);
    setError(null);
    const action = resolveWaiveAction({
      rejectedRequest: capError !== null,
      inputReady: parsedAmount > 0,
    });
    if (action === "resubmit") {
      // capError stays until this lands: it keeps the limit screen (and its
      // spinner) up instead of flashing the keypad mid-request, and a failure
      // leaves the decision exactly where the manager made it.
      await handleAdd(true);
      return;
    }
    setCapError(null);
  }

  async function handleRedeem(rewardId: string) {
    if (redeemingRewardId) return;
    const fingerprint = scanFingerprint({
      action: "redeem",
      businessId,
      enrollmentId,
      locationId: selectedLocation?.id ?? null,
      rewardId,
    });
    const claim = claimClientKey(clientKeys.current, fingerprint, mintClientKey);
    clientKeys.current = claim.ledger;
    const before = redeemSnapshot(null);

    try {
      setRedeemingRewardId(rewardId);
      setPhase("submitting");
      setError(null);
      setRetryable(false);
      setAlreadyCounted(false);
      setBalanceBeforeRedeem(balance);
      setRedeemedRewardName(ladder.find((r) => r.id === rewardId)?.name ?? null);
      const result = await redeemReward(
        businessId,
        enrollmentId,
        selectedLocation?.id,
        rewardId,
        null,
        claim.key
      );
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      setRedeemResult(result);
      setRewardsMenuOpen(false);
      syncBalance(valueOf(result));
      if (result.replayed) setAlreadyCounted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setRewardsMenuOpen(false);
      await handleRedeemFailure(err, before, fingerprint);
    } finally {
      setRedeemingRewardId(null);
      setPhase("idle");
    }
  }

  /** What this customer stood at before a redemption, for the reconcile. */
  function redeemSnapshot(instanceId: string | null): ReconcileTarget {
    return {
      action: "redeem",
      instanceId,
      stamps: customer?.stamps ?? balance,
      rewards: heldRewards.length,
      balance,
    };
  }

  async function handleRedeemFailure(
    err: unknown,
    before: ReconcileTarget,
    fingerprint: string
  ) {
    const failure = classifyMutationFailure(err);

    if (failure === "timeout") {
      const fresh = await reconcile();
      const verdict = reconcileVerdict(before, fresh);
      if (verdict === "credited" && fresh) {
        // The reward is already spent. Saying otherwise hands over a second.
        clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
        setCustomer(fresh);
        const after = fresh.program?.primary_value ?? fresh.stamps;
        setRedeemResult({
          customer_id: fresh.id,
          name: fresh.name,
          stamps: after,
          value_after: after,
          message: "",
        });
        setAlreadyCounted(true);
        await acknowledge();
        return;
      }
      setError(tStamp(recoveryErrorKey(verdict) as never));
      setRetryable(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "offline") {
      setError(tStamp("errors.offline"));
      setRetryable(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "conflict") {
      console.warn("[Scan] client_key conflict on redeem, dropping the key");
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      setError(t("errors.redeemFailed"));
      setRetryable(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    mapActionError(err, "errors.redeemFailed");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  /**
   * Redeem one reward the customer already HOLDS.
   *
   * Distinct from handleRedeem above: that one buys off the menu and debits
   * the balance, this one consumes a reward they were already given, so the
   * balance is untouched and no ladder reward is involved.
   */
  async function handleRedeemHeld(instance: BankedReward) {
    if (redeemingRewardId || redeemingHeldId) return;
    const fingerprint = scanFingerprint({
      action: "redeem",
      businessId,
      enrollmentId,
      locationId: selectedLocation?.id ?? null,
      customerRewardId: instance.id,
    });
    const claim = claimClientKey(clientKeys.current, fingerprint, mintClientKey);
    clientKeys.current = claim.ledger;
    const before = redeemSnapshot(instance.id);

    try {
      setRedeemingHeldId(instance.id);
      setPhase("submitting");
      setError(null);
      setRetryable(false);
      setAlreadyCounted(false);
      setBalanceBeforeRedeem(balance);
      setRedeemedRewardName(instance.name);
      const result = await redeemReward(
        businessId,
        enrollmentId,
        selectedLocation?.id,
        null,
        instance.id,
        claim.key
      );
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      setRedeemResult(result);
      setRewardsMenuOpen(false);
      syncBalance(valueOf(result));
      if (result.replayed) setAlreadyCounted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setRewardsMenuOpen(false);
      await handleRedeemFailure(err, before, fingerprint);
    } finally {
      setRedeemingHeldId(null);
      setPhase("idle");
    }
  }

  function handleDone() {
    router.back();
  }
  function handleGoHome() {
    // Unwinds the scanner too: the lobby is below both of these.
    router.dismissTo("/lobby");
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, width: "100%" },
        topGroup: { gap: 12 },
        // Solid filled pill so it reads as a tappable button and stays legible
        // for ANY brand color. The previous pale-tint-on-tint version vanished
        // for light `primary` palettes (text color == background). primaryText is
        // the design's guaranteed-contrast foreground on primary.
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 11,
          paddingHorizontal: 16,
          borderRadius: 9999,
          backgroundColor: theme.primary,
        },
        chipWrap: { alignSelf: "flex-start" },
        chipText: { color: theme.primaryText, fontSize: 15, fontWeight: "700" },
        middle: { flex: 1, justifyContent: "center" },
        bottomGroup: { gap: 12 },
        addButton: {
          backgroundColor: theme.primary,
          paddingVertical: 18,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
        },
        addButtonText: { color: theme.primaryText, fontSize: 20, fontWeight: "bold" },
        cancelButton: { padding: 12, alignItems: "center" },
        cancelText: { color: theme.textSecondary, fontSize: 16 },
        // Success states — full-height: header on top, balance hero centered in
        // the remaining space, actions anchored at the bottom (where the thumb
        // already is after tapping "Add points").
        successRoot: { flex: 1, width: "100%", alignItems: "center" },
        successHeader: { alignItems: "center", paddingTop: 8 },
        successHeaderText: { alignItems: "center" },
        successIcon: {
          width: 72,
          height: 72,
          borderRadius: 36,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        },
        successTitle: { fontSize: 24, fontWeight: "700", color: theme.text, marginBottom: 4, textAlign: "center" },
        successName: { fontSize: 15, color: theme.textSecondary, textAlign: "center" },
        successHero: {
          flex: 1,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        },
        earnedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        earnedText: { color: SUCCESS_GREEN, fontSize: 17, fontWeight: "600" },
        balanceRow: { flexDirection: "row", alignItems: "flex-end" },
        balanceBig: { fontSize: 62, fontWeight: "700", color: theme.text, lineHeight: 66 },
        balanceUnit: { fontSize: 24, fontWeight: "600", color: theme.textSecondary, marginLeft: 7, marginBottom: 8 },
        successActions: { width: "100%", gap: 2 },
        // Earning-limit notices: amber, not red. Nothing went wrong.
        capNotice: {
          marginTop: 12,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: UNLOCK_TINT,
        },
        capNoticeText: {
          fontSize: 13,
          fontWeight: "600",
          color: UNLOCK_AMBER,
          textAlign: "center",
        },
        boostUpcoming: {
          marginTop: 12,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.04)",
        },
        boostUpcomingText: {
          fontSize: 13,
          fontWeight: "600",
          color: theme.textSecondary,
          textAlign: "center",
        },
        boostNoteText: {
          marginTop: 8,
          fontSize: 13.5,
          lineHeight: 19,
          fontWeight: "600",
          color: UNLOCK_AMBER,
          textAlign: "center",
        },
        capNoteText: {
          marginTop: 8,
          fontSize: 13.5,
          lineHeight: 19,
          fontWeight: "600",
          color: UNLOCK_AMBER,
          textAlign: "center",
        },
        // Always present, so the in-flight line can appear and disappear
        // without moving the amount above it or the keypad below it.
        hintRow: { height: 26, justifyContent: "center", marginTop: 6 },
        hintText: {
          fontSize: 15,
          fontWeight: "600",
          color: theme.textSecondary,
          textAlign: "center",
        },
        // Locked, not hidden, while a request is in flight.
        lockedExit: { opacity: 0.35 },
        inlineError: {
          backgroundColor: "#fef2f2",
          padding: 12,
          borderRadius: 8,
          marginTop: 16,
          width: "100%",
        },
        inlineErrorText: { color: "#dc2626", textAlign: "center" },
        primaryButton: {
          backgroundColor: theme.primary,
          paddingVertical: 18,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        },
        primaryButtonText: { color: theme.primaryText, fontSize: 20, fontWeight: "bold" },
        redeemNowButton: {
          flexDirection: "row",
          gap: 10,
          backgroundColor: "#22c55e",
          paddingVertical: 18,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        },
        redeemNowText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
        skipButton: { padding: 14, alignItems: "center" },
      }),
    [theme]
  );

  // Paused membership — shared status screen (stamp copy is scanning-generic).
  if (isPausedError) {
    return (
      <StatusScreen
        icon={<PauseCircle size={48} color="#fff" weight="fill" />}
        iconColor="#D97706"
        title={tStamp("errors.pausedTitle")}
        message={tStamp("errors.pausedMessage")}
        primary={{ label: tStamp("errors.goHome"), onPress: handleGoHome }}
      />
    );
  }

  // Earning limit reached: replace the keypad rather than let the employee
  // punch in a ticket the server is going to refuse.
  const blockingCap =
    capError ??
    (!capOverride && earningCap && earningCap.remaining <= 0
      ? { ...earningCap, can_override: undefined }
      : null);
  if (blockingCap && !addResult && !redeemResult) {
    return (
      <CapBlockedScreen
        customerName={customer?.name ?? ""}
        cap={blockingCap}
        serverAllowsOverride={blockingCap.can_override}
        onOverride={handleWaive}
        overriding={adding}
        errorMessage={error}
        onDone={handleDone}
      />
    );
  }

  // Redeem success: reward claimed, balance spent down. Full-height layout:
  // what happened on top, the new balance as the hero, actions at the bottom.
  if (redeemResult) {
    const after = valueOf(redeemResult);
    const next = nextReward(ladder, after);
    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[styles.successIcon, { backgroundColor: SUCCESS_TINT }]}
            >
              {/* No confetti for a redemption we are merely CONFIRMING: the
                  handover already happened. */}
              {alreadyCounted ? (
                <Check size={36} color={SUCCESS_GREEN} weight="bold" />
              ) : (
                <Confetti size={36} color={SUCCESS_GREEN} weight="fill" />
              )}
            </Animated.View>
            <Animated.View entering={BODY_ENTER} style={styles.successHeaderText}>
              <Text style={styles.successTitle}>
                {alreadyCounted ? t("redeem.alreadyRedeemed") : t("redeem.title")}
              </Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer?.name ?? ""}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {redeemedRewardName && (
              <View style={styles.earnedRow}>
                <Gift size={16} color={SUCCESS_GREEN} weight="fill" />
                <Text style={styles.earnedText} numberOfLines={1}>
                  {redeemedRewardName}
                </Text>
              </View>
            )}
            <View style={styles.balanceRow}>
              <AnimatedBalance from={balanceBeforeRedeem} to={after} style={styles.balanceBig} />
              <Text style={styles.balanceUnit}>{t("unit")}</Text>
            </View>
            {ladder.length > 0 && (
              <PointsProgress
                value={after}
                nextThreshold={next?.threshold ?? null}
                nextRewardName={next?.name}
              />
            )}
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            <PressableScale style={styles.primaryButton} onPress={handleDone}>
              <Text style={styles.primaryButtonText}>{t("success.scanNext")}</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Add success: points credited.
  if (addResult) {
    const after = valueOf(addResult);
    const earned = Math.max(0, after - balanceBeforeAdd);
    const justCrossed = ladder.some((r) => balanceBeforeAdd < r.threshold && r.threshold <= after);
    const canRedeem = ladder.some((r) => r.threshold <= after) || heldRewards.length > 0;
    const next = nextReward(ladder, after);
    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[
                styles.successIcon,
                {
                  backgroundColor:
                    justCrossed && !alreadyCounted ? UNLOCK_TINT : SUCCESS_TINT,
                },
              ]}
            >
              {/* The reward, if one was unlocked, was announced by the request
                  this one repeats. The CTA below still offers it, read off the
                  balance, but the screen does not celebrate it twice. */}
              {justCrossed && !alreadyCounted ? (
                <Confetti size={36} color={UNLOCK_AMBER} weight="fill" />
              ) : (
                <Check size={36} color={SUCCESS_GREEN} weight="bold" />
              )}
            </Animated.View>
            <Animated.View entering={BODY_ENTER} style={styles.successHeaderText}>
              <Text style={styles.successTitle}>
                {alreadyCounted
                  ? t("success.alreadyCounted")
                  : justCrossed
                    ? t("reward.unlocked")
                    : addResult.cap_applied
                      ? tStamp("cap.partialTitle")
                      : t("success.title")}
              </Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer?.name ?? ""}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {earned > 0 && (
              <Text style={styles.earnedText}>{t("success.earned", { count: earned })}</Text>
            )}
            {/* What the boost added, broken out from the base. Hidden when the
                cap clamped the scan: the pre-clamp bonus never fully landed,
                and the cap note below is the honest line. */}
            {addResult.boost_applied && !addResult.cap_applied && (addResult.boost_bonus ?? 0) > 0 && (
              <Text style={styles.boostNoteText}>
                {t("boost.successNote", {
                  base: addResult.boost_base ?? 0,
                  bonus: addResult.boost_bonus ?? 0,
                })}
              </Text>
            )}
            {/* Never let a clamped scan read as a clean success. */}
            {addResult.cap_applied && (
              <Text style={styles.capNoteText}>
                {tStamp(
                  addResult.cap_scope === "week" ? "cap.partialWeek" : "cap.partialDay",
                  { added: earned, requested: addResult.cap_requested ?? earned }
                )}
              </Text>
            )}
            <View style={styles.balanceRow}>
              <AnimatedBalance from={balanceBeforeAdd} to={after} style={styles.balanceBig} />
              <Text style={styles.balanceUnit}>{t("unit")}</Text>
            </View>
            {ladder.length > 0 && (
              <PointsProgress
                value={after}
                nextThreshold={next?.threshold ?? null}
                nextRewardName={next?.name}
                previousValue={balanceBeforeAdd}
              />
            )}
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            {canRedeem ? (
              <PressableScale
                style={styles.redeemNowButton}
                haptic="medium"
                onPress={() => setRewardsMenuOpen(true)}
              >
                <Gift size={22} color="#fff" weight="bold" />
                <Text style={styles.redeemNowText}>{t("reward.redeemNow")}</Text>
              </PressableScale>
            ) : (
              <PressableScale style={styles.primaryButton} onPress={handleDone}>
                <Text style={styles.primaryButtonText}>{t("success.scanNext")}</Text>
              </PressableScale>
            )}
            {canRedeem && (
              <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
                <Text style={styles.cancelText}>{t("success.scanNext")}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {/* Held rewards belong here as much as on the entry screen: canRedeem
            above is true when the customer holds one even if nothing on the
            ladder is affordable, so without these the "Redeem now" they just
            tapped opens a sheet of locked prices and no way to hand over the
            reward the customer is visibly holding. */}
        <RewardsMenu
          visible={rewardsMenuOpen}
          onClose={() => setRewardsMenuOpen(false)}
          rewards={ladder}
          balance={after}
          onRedeem={handleRedeem}
          redeemingRewardId={redeemingRewardId}
          heldRewards={heldRewards}
          onRedeemHeld={handleRedeemHeld}
          redeemingHeldId={redeemingHeldId}
        />
      </ConfirmationScaffold>
    );
  }

  // Entry: keypad-first. The header line packs the glanceable facts: balance
  // plus how far the next reward is, so the employee can say it out loud.
  const entryNext = program ? nextReward(ladder, program.primary_value) : null;
  const balanceLabel = program
    ? entryNext
      ? `${t("balance", { count: program.primary_value })} · ${t("success.toNextReward", {
          count: entryNext.threshold - program.primary_value,
          reward: entryNext.name,
        })}`
      : t("balance", { count: program.primary_value })
    : null;

  return (
    <ConfirmationScaffold>
      <View style={styles.root}>
        <View style={styles.topGroup}>
          <CustomerHeader name={customer?.name ?? null} balance={balanceLabel} loading={loading} />
          {rewardReady && (
            <Animated.View entering={SOFT_ENTER} style={styles.chipWrap}>
              {/* Locked mid-request: opening the reward picker now would let a
                  redemption start on top of an add whose outcome is unknown. */}
              <PressableScale
                style={[styles.chip, inFlight && styles.lockedExit]}
                scaleTo={0.95}
                disabled={inFlight}
                onPress={() => setRewardsMenuOpen(true)}
              >
                <Gift size={18} color={theme.primaryText} weight="fill" />
                <Text style={styles.chipText}>
                  {t(`rewardsAvailable_${selectPluralForm(i18n.language, redeemableCount)}`, {
                    count: redeemableCount,
                  })}
                </Text>
                <CaretRight size={16} color={theme.primaryText} weight="bold" />
              </PressableScale>
            </Animated.View>
          )}
        </View>

        <View style={styles.middle}>
          <AmountDisplay amount={amount} currencySymbol={currency} pointsPreview={pointsPreview} />
          {/* Reserved whether or not there is anything to say, so a slow
              network never shoves the keypad down mid-tap. */}
          <View style={styles.hintRow}>
            {hintKey && (
              <Animated.Text key={hintKey} entering={SOFT_ENTER} style={styles.hintText}>
                {tStamp(hintKey as never)}
              </Animated.Text>
            )}
          </View>
          {capOverride && (
            <Animated.View entering={SOFT_ENTER} style={styles.capNotice}>
              <Text style={styles.capNoticeText}>{tStamp("cap.overrideActiveNotice")}</Text>
            </Animated.View>
          )}
          {/* Say the boost out loud BEFORE the press, so the employee can tell
              the customer "add a little and it doubles" rather than the bonus
              landing as an unexplained number. */}
          {boostPreview.tier && !willClamp && (
            <Animated.View entering={SOFT_ENTER} style={styles.capNotice}>
              <Text style={styles.capNoticeText}>
                {t("boost.active", { count: boostPreview.bonus })}
              </Text>
            </Animated.View>
          )}
          {!boostPreview.tier && boostPreview.nextTier && parsedAmount > 0 && (
            <Animated.View entering={SOFT_ENTER} style={styles.boostUpcoming}>
              <Text style={styles.boostUpcomingText}>
                {t("boost.upcoming", {
                  amount: formatThreshold(boostPreview.nextTier.threshold),
                  currency,
                })}
              </Text>
            </Animated.View>
          )}
          {/* Warn BEFORE the press: this ticket is worth more than the limit
              still allows, so only part of it will land. */}
          {willClamp && !capOverride && (
            <Animated.View entering={SOFT_ENTER} style={styles.capNotice}>
              <Text style={styles.capNoticeText}>
                {t("cap.previewClamped", { count: capRemaining })}
              </Text>
            </Animated.View>
          )}
          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.bottomGroup}>
          <Keypad onKeyPress={handleKey} separator={separator} disabled={adding} />
          <Animated.View style={addOpacityStyle}>
            <PressableScale
              style={styles.addButton}
              haptic="medium"
              onPress={() => handleAdd()}
              disabled={adding || !canAdd}
            >
              {adding ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <Text style={styles.addButtonText}>
                  {/* Same button, same place under the thumb. It re-sends the
                      same body with the same key, so it cannot double-credit
                      even if the first attempt did land. */}
                  {retryable ? tCommon("retry") : t("addPoints")}
                </Text>
              )}
            </PressableScale>
          </Animated.View>
          {/* Locked while a request is in flight: leaving now and rescanning
              would mint a new key for the same ticket. */}
          <TouchableOpacity
            style={[styles.cancelButton, inFlight && styles.lockedExit]}
            onPress={handleDone}
            disabled={inFlight}
          >
            <Text style={styles.cancelText}>{tCommon("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <RewardsMenu
        visible={rewardsMenuOpen}
        onClose={() => setRewardsMenuOpen(false)}
        rewards={ladder}
        balance={balance}
        onRedeem={handleRedeem}
        redeemingRewardId={redeemingRewardId}
        heldRewards={heldRewards}
        onRedeemHeld={handleRedeemHeld}
        redeemingHeldId={redeemingHeldId}
      />
    </ConfirmationScaffold>
  );
}
