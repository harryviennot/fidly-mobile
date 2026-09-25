import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { blendColors } from "@/utils/colors";
import { Check, Confetti, Gift, PauseCircle, X } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { addStamp, getCustomer, redeemReward } from "@/api/customers";
import { classifyMutationFailure, redeemErrorKey, stampErrorKey } from "@/utils/apiErrors";
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
  ownsRetry,
  reconcileVerdict,
  reconciledResponse,
  recoveryErrorKey,
  type ReconcileTarget,
  type RetryTarget,
  type ScanPhase,
} from "@/utils/scanRecovery";
import { useScanLock } from "@/contexts/scan-lock-context";
import { createWriteLock } from "@/utils/writeLock";
import { useLockedDim } from "@/hooks/use-locked-dim";
import { MUTATION_TIMEOUT_MS } from "@/api/client";
import { markScanCompleted } from "@/lib/app-rating";
import { useLocation } from "@/contexts/location-context";
import { useTheme } from "@/contexts/theme-context";
import { clampStampQuantity, maxStampQuantity } from "@/utils/stamps";
import { resolveWaiveAction } from "@/utils/cap";
import { selectPluralForm } from "@/utils/plural";
import { HeldRewardsList } from "@/components/confirmation/HeldRewardsList";
import type { BankedReward, Customer, StampResponse } from "@/types/api";
import { PressableScale } from "@/components/PressableScale";
import { ConfirmationScaffold } from "./ConfirmationScaffold";
import { StatusScreen } from "./StatusScreen";
import { StampGrid } from "./StampGrid";
import { StampStepper } from "./StampStepper";
import { CapBlockedScreen } from "./CapBlockedScreen";
import { CustomerHeader } from "./CustomerHeader";
import { AnimatedBalance } from "./AnimatedBalance";
import { ACTION_ENTER, BODY_ENTER, DETAIL_ENTER, ICON_ENTER, SOFT_ENTER } from "./animations";
import { SUCCESS_GREEN, SUCCESS_TINT, UNLOCK_AMBER, UNLOCK_TINT } from "./palette";

interface StampFlowProps {
  customer: Customer;
  setCustomer: Dispatch<SetStateAction<Customer | null>>;
  businessId: string;
  enrollmentId: string;
}

/**
 * Stamp-program confirmation flow.
 *
 * One scan can be worth several stamps: the stepper sets the quantity, the card
 * previews it as ghost dots, and a single request credits the lot (one
 * transaction, one wallet push, one banner for the customer) instead of the
 * employee pressing the button five times.
 *
 * Laid out like the points keypad screen: facts on top, the card in the middle,
 * the controls anchored at the bottom where the thumb already is.
 */
export function StampFlow({ customer, setCustomer, businessId, enrollmentId }: StampFlowProps) {
  const { t, i18n } = useTranslation("stamp");
  const { t: tCommon } = useTranslation("common");
  const { t: tLocation } = useTranslation("location");
  const { selectedLocation } = useLocation();
  const { theme, design, refreshTheme } = useTheme();

  const [stamping, setStamping] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  // Which held reward is mid-redeem, so only that row shows a spinner.
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPausedError, setIsPausedError] = useState(false);
  const [success, setSuccess] = useState<StampResponse | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  // How far along the request in flight is: drives the hint line and locks the
  // ways out of the screen. See utils/scanRecovery.
  const [phase, setPhase] = useState<ScanPhase>("idle");
  // WHICH operation a second tap would re-send, or null. Never a bare boolean:
  // a failed redeem must not put "Retry" on the button that adds a stamp.
  const [retry, setRetry] = useState<RetryTarget | null>(null);
  // This success was credited by a request we never heard back from. Same
  // layout, different title, and no second celebration.
  const [alreadyCounted, setAlreadyCounted] = useState(false);
  /**
   * The idempotency key per request body, for the life of this screen.
   *
   * A retry of the same request reuses its key and the backend replays the
   * original answer instead of crediting twice; any change to the body (the
   * stepper, a waived cap, a different reward) is a different request and gets
   * a key of its own. See api/idempotency.ts.
   */
  const clientKeys = useRef<ClientKeyLedger>({});
  // Held by whichever write is in flight; every other write refuses to start.
  const [writeLock] = useState(createWriteLock);
  // Card state before the last stamp — detects a rollover (stackable rewards:
  // stamps reset below the goal but a reward was banked) and drives the
  // count-up + the stagger on the dots that were just added.
  const [preStampRewards, setPreStampRewards] = useState(0);
  const [preStampStamps, setPreStampStamps] = useState(0);
  // Manager decided to push this customer past their earning limit. Lives for
  // one scan; the request carries it and the server re-checks the role.
  const [capOverride, setCapOverride] = useState(false);
  // Cap standing the LAST request reported, when it beat the snapshot (another
  // device scanned this customer while this screen was open).
  const [capError, setCapError] = useState<{
    scope: "day" | "week";
    limit: number;
    resets_at: string;
    can_override?: boolean;
  } | null>(null);

  // Program config is the source of truth for the goal; the design column
  // is a deprecated synced copy kept as fallback.
  const totalStamps = customer.total_stamps ?? design?.total_stamps ?? 10;
  const stackable = customer.stackable_rewards ?? false;
  const maxStack = customer.max_stacked_rewards ?? null;
  // Reward INSTANCES the customer holds (STA-264). The scalar `rewards` count
  // stays as the fallback for backends that predate the snapshot field.
  const heldRewards: BankedReward[] = customer.program?.banked_rewards ?? [];
  const rewards = heldRewards.length || (customer.rewards ?? 0);
  const currentStamps = customer.stamps || 0;
  const cardFull = currentStamps >= totalStamps;
  // Blocked at the stack cap: behaves exactly like the classic full card.
  const atMaxStack = stackable && maxStack != null && rewards >= maxStack && cardFull;
  // Classic redeem-or-skip screen: non-stackable full card, or capped stack.
  const isReadyForReward = cardFull && (!stackable || atMaxStack);
  // Stackable flow: stamping continues, banked rewards redeemable anytime.
  const hasBankedRewards = stackable && rewards > 0 && !isReadyForReward;

  // How many stamps this scan is worth. Capped at what the card can absorb, so
  // the stepper never promises stamps the server would drop.
  const [quantity, setQuantity] = useState(1);
  const earningCap = customer.program?.earning_cap ?? null;
  const maxQuantity = useMemo(
    () =>
      maxStampQuantity({
        totalStamps,
        currentStamps,
        stackable,
        // An override lifts the cap for this scan, so the stepper goes back to
        // what the card can hold.
        capRemaining: capOverride ? null : earningCap?.remaining ?? null,
      }),
    [totalStamps, currentStamps, stackable, earningCap?.remaining, capOverride]
  );
  // The ceiling moves when the customer snapshot refreshes (a concurrent scan on
  // another device); pull the quantity back in rather than sending a stale one.
  useEffect(() => {
    setQuantity((q) => clampStampQuantity(q, maxQuantity));
  }, [maxQuantity]);

  const willCompleteCard = currentStamps + quantity >= totalStamps;

  // Anything in flight: the spinner is up, and the ways off this screen are
  // locked. Backing out mid-request and rescanning would mint a NEW key, which
  // is the one double-credit the idempotency key cannot close.
  const inFlight = phase !== "idle";
  const hintKey = hintKeyForPhase(phase);

  // The route reads this to turn off the swipe-back gesture and swallow the
  // Android back button. Leaving mid-request and rescanning is what mints a
  // second key for one tap.
  const { setLocked } = useScanLock();
  // One rule, one value, for every control this screen locks.
  const lockedDim = useLockedDim(inFlight);
  const redeemingDim = useLockedDim(redeeming);
  useEffect(() => {
    setLocked(inFlight);
    return () => setLocked(false);
  }, [inFlight, setLocked]);

  // A request that has not answered in three seconds gets a quiet line saying
  // so, in the slot the quantity line already reserves. No layout shift, and a
  // healthy scan never shows it.
  useEffect(() => {
    if (phase !== "submitting") return;
    const timer = setTimeout(
      () => setPhase((current) => (current === "submitting" ? "slow" : current)),
      SLOW_HINT_AFTER_MS
    );
    return () => clearTimeout(timer);
  }, [phase]);

  // A different quantity is a different request, so the CTA stops offering to
  // retry the old one. A pending REDEEM retry is untouched: the stepper has
  // nothing to do with it. The banner stays either way, since what happened is
  // still worth reading.
  useEffect(() => {
    setRetry((current) => (current?.kind === "stamp" ? null : current));
  }, [quantity]);

  // Explicit plural key selection: we know the count, so never show a "(s)"
  // guess. (The form is picked in JS rather than by i18next, whose resolver is
  // built on Intl.PluralRules and unreliable on Hermes. Polish needs one/few/
  // many, so a "1 or not 1" ternary is not enough.)
  const plural = (count: number) => selectPluralForm(i18n.language, count);

  const rewardsWaitingText = (count: number) =>
    t(`success.rewardsWaiting_${plural(count)}`, { count });

  /**
   * The payoff. A success notification, then one light tick per stamp so a
   * 5-stamp scan is *felt* as five, capped so a big batch doesn't buzz forever.
   * A heavier tap lands last when the scan earned a reward.
   */
  async function celebrate(stampsAdded: number, earnedReward: boolean) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const ticks = Math.min(stampsAdded, 5);
    for (let i = 1; i < ticks; i++) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, i * 55);
    }
    if (earnedReward) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, ticks * 55 + 80);
    }
  }

  /** The one tap a reconciled success is allowed. No cascade, no reward beat. */
  async function acknowledge() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  /**
   * Go and find out what happened.
   *
   * Exactly ONE read, never a re-send: a write we cannot account for is not
   * something to repeat on the customer's behalf. Returns null when even the
   * read fails, which is a different screen (offline) from a read that came
   * back saying nothing moved.
   */
  async function reconcile(): Promise<Customer | null> {
    setPhase("confirming");
    try {
      return await getCustomer(businessId, enrollmentId, {
        timeoutMs: MUTATION_TIMEOUT_MS,
      });
    } catch {
      return null;
    }
  }

  /**
   * `overrideNow` is the manager's just-made decision, passed explicitly because
   * the `capOverride` state it also sets is not readable until the next render.
   */
  async function handleAddStamp(overrideNow?: boolean) {
    const override = overrideNow ?? capOverride;
    // The key is filed under this exact request. Pressing Retry re-sends the
    // same body and therefore the same key; changing the quantity or waiving
    // the cap makes it a different request, which mints a new one.
    const fingerprint = scanFingerprint({
      action: "stamp",
      businessId,
      enrollmentId,
      locationId: selectedLocation?.id ?? null,
      quantity,
      capOverride: override,
    });
    const before: ReconcileTarget = {
      action: "stamp",
      stamps: currentStamps,
      rewards,
      expected: quantity,
    };

    if (!writeLock.tryAcquire()) return;
    try {
      setStamping(true);
      setPhase("submitting");
      setError(null);
      setRetry(null);
      // This attempt is its own: a previous one having been merely confirmed
      // must not put "already counted" on top of a fresh success.
      setAlreadyCounted(false);
      setPreStampRewards(rewards);
      setPreStampStamps(currentStamps);
      // Minted INSIDE the try. randomUUID is missing on older web builds and
      // throws when it is; out here that throw escaped the press handler and
      // the button did nothing at all, with no spinner and no banner.
      const claim = claimClientKey(clientKeys.current, fingerprint, mintClientKey);
      clientKeys.current = claim.ledger;
      const result = await addStamp(
        businessId,
        enrollmentId,
        selectedLocation?.id,
        quantity,
        override,
        claim.key
      );
      // Settled: from here an identical tap is a second deliberate scan and has
      // to be credited as one.
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      setSuccess(result);
      setCustomer((prev) =>
        prev ? { ...prev, stamps: result.stamps, rewards: result.rewards ?? prev.rewards } : null
      );
      if (result.replayed) {
        // Our own request, answered a second time. The customer was credited by
        // the first one, which already ran the banner and the celebration, so
        // this says "already counted" and taps once. `reward_earned` is
        // deliberately false on a replay, so the screen reads the BALANCE to
        // decide whether a reward is owed.
        setAlreadyCounted(true);
        await acknowledge();
      } else {
        const added = result.delta ?? Math.max(0, result.stamps - currentStamps);
        const earned = result.stamps >= totalStamps || (result.rewards ?? 0) > rewards;
        await celebrate(added, earned);
      }
      // Arm the one-time rating prompt. It is NOT shown here — it fires when the
      // employee next returns to the lobby, so it never interrupts scanning.
      markScanCompleted();
    } catch (err) {
      await handleAddFailure(err, before, fingerprint);
    } finally {
      writeLock.release();
      setStamping(false);
      setPhase("idle");
    }
  }

  /**
   * What a failed stamp means, and which of the four recoveries it gets.
   *
   * The coded gates come first and are untouched by STA-340: the backend
   * refused on purpose and this screen already explains why. Only the
   * transport-level outcomes below reach the new states.
   */
  async function handleAddFailure(
    err: unknown,
    before: ReconcileTarget,
    fingerprint: string
  ) {
    const failure = classifyMutationFailure(err);

    if (failure === "timeout") {
      // Sent, never answered. It may have landed, so ask before saying anything.
      const fresh = await reconcile();
      const verdict = reconcileVerdict(before, fresh);
      if (verdict === "credited" && fresh) {
        clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
        setCustomer(fresh);
        setSuccess(reconciledResponse(fresh));
        setAlreadyCounted(true);
        await acknowledge();
        markScanCompleted();
        return;
      }
      // Unchanged: confirmed nothing landed. Unknown: the read failed too, so
      // the copy promises only that trying again is safe.
      setError(t(recoveryErrorKey(verdict) as never));
      setRetry({ kind: "stamp" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "offline") {
      // Nothing left the phone, so there is nothing to reconcile.
      setError(t("errors.offline"));
      setRetry({ kind: "stamp" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "conflict") {
      // A bug of ours: this key is held by a different request. Retrying it
      // would 409 forever, so the key is dropped and the next tap mints a new
      // one (the scan it was meant for was never credited HERE).
      console.warn("[Scan] client_key conflict on stamp, dropping the key");
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      setError(t("errors.stampFailed"));
      setRetry(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "server") {
      setError(t(stampErrorKey(err) as never));
      setRetry({ kind: "stamp" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    await applyStampGate(err);
  }

  /** The gate ladder, unchanged from before this stage. */
  async function applyStampGate(err: unknown) {
    {
      const code = (err as any)?.code;
      if (code === "MEMBER_PAUSED") {
        setIsPausedError(true);
      } else if (code === "EARNING_CAP_REACHED") {
        // The snapshot said there was room, but another device used it first.
        // Show the same blocked screen rather than a bare error line.
        const detail = (err as any)?.detail ?? {};
        setCapError({
          scope: detail.scope === "week" ? "week" : "day",
          limit: detail.limit ?? 0,
          resets_at: detail.resets_at ?? "",
          can_override: detail.can_override ?? false,
        });
      } else if (code === "CAP_OVERRIDE_NOT_ALLOWED") {
        setCapOverride(false);
        setError(t("cap.overrideNotAllowed"));
      } else if (code === "CHECKOUT_REQUIRED") {
        setError(t("errors.checkoutRequired"));
      } else if (code === "BILLING_REQUIRED") {
        setError(t("errors.billingRequired"));
      } else if (code === "ACCESS_DENIED") {
        setError(t("errors.accessDenied"));
      } else if (code === "LOCATION_NOT_PERMITTED") {
        setError(tLocation("errors.notPermitted"));
      } else if (code === "LOCATION_REQUIRED" || code === "LOCATION_NOT_FOUND") {
        setError(tLocation("errors.locationRequired"));
      } else if (code === "AMOUNT_REQUIRED") {
        // The program converted to points between our customer fetch and this
        // tap. Explain, and force-refresh the cached design so the next scan
        // opens the points keypad directly.
        setError(t("errors.programNowPoints"));
        refreshTheme(true);
      } else {
        setError(t(stampErrorKey(err) as never));
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  /**
   * Manager waives the limit. When the block came from a rejected request the
   * quantity is still on screen and already confirmed, so send it straight
   * through rather than dropping them back on the stepper to press "Add stamp"
   * a second time on a quantity they never changed.
   */
  async function handleWaive() {
    setCapOverride(true);
    setError(null);
    const action = resolveWaiveAction({
      rejectedRequest: capError !== null,
      inputReady: quantity >= 1,
    });
    if (action === "resubmit") {
      // capError stays until this lands: it keeps the limit screen (and its
      // spinner) up instead of flashing the stepper mid-request, and a failure
      // leaves the decision exactly where the manager made it.
      await handleAddStamp(true);
      return;
    }
    setCapError(null);
  }

  async function handleRedeemReward(instance?: BankedReward) {
    // A redemption's key is its own: one minted for a stamp and replayed here
    // would be free goods, which is why the backend answers a key crossing
    // operations with a 409 rather than a replay.
    const fingerprint = scanFingerprint({
      action: "redeem",
      businessId,
      enrollmentId,
      locationId: selectedLocation?.id ?? null,
      customerRewardId: instance?.id ?? null,
    });
    const before: ReconcileTarget = {
      action: "redeem",
      instanceId: instance?.id ?? null,
      stamps: currentStamps,
      rewards,
      balance: currentStamps,
    };

    if (!writeLock.tryAcquire()) return;
    try {
      setRedeeming(true);
      setRedeemingId(instance?.id ?? null);
      setPhase("submitting");
      setError(null);
      setRetry(null);
      setAlreadyCounted(false);
      // Minted inside the try, for the same reason as the stamp path.
      const claim = claimClientKey(clientKeys.current, fingerprint, mintClientKey);
      clientKeys.current = claim.ledger;
      // Naming the instance is what lets a granted item be redeemed at all —
      // a gift sits on no ladder, so there is no reward_id to send instead.
      const result = await redeemReward(
        businessId,
        enrollmentId,
        selectedLocation?.id,
        null,
        instance?.id ?? null,
        claim.key
      );
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      // Banked redemptions keep stamp progress; only the classic full-card
      // redemption resets to 0. Trust the server's response either way.
      setCustomer((prev) =>
        prev ? { ...prev, stamps: result.stamps, rewards: result.rewards ?? 0 } : null
      );
      setRedeemSuccess(true);
      setSuccess(result);
      if (result.replayed) {
        setAlreadyCounted(true);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      await handleRedeemFailure(err, before, fingerprint);
    } finally {
      writeLock.release();
      setRedeeming(false);
      setRedeemingId(null);
      setPhase("idle");
    }
  }

  async function handleRedeemFailure(
    err: unknown,
    before: ReconcileTarget,
    fingerprint: string
  ) {
    const failure = classifyMutationFailure(err);
    // The retry belongs to the control that failed, and for a named reward
    // that is its own row, not the generic CTA.
    const instanceId = before.action === "redeem" ? before.instanceId : null;

    if (failure === "timeout") {
      const fresh = await reconcile();
      const verdict = reconcileVerdict(before, fresh);
      if (verdict === "credited" && fresh) {
        // The reward is already spent. Saying otherwise would hand over a
        // second one.
        clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
        setCustomer(fresh);
        setRedeemSuccess(true);
        setSuccess(reconciledResponse(fresh));
        setAlreadyCounted(true);
        await acknowledge();
        return;
      }
      setError(t(recoveryErrorKey(verdict) as never));
      setRetry({ kind: "redeem", instanceId });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "offline") {
      setError(t("errors.offline"));
      setRetry({ kind: "redeem", instanceId });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (failure === "conflict") {
      console.warn("[Scan] client_key conflict on redeem, dropping the key");
      clientKeys.current = releaseClientKey(clientKeys.current, fingerprint);
      setError(t("errors.redeemFailed"));
      setRetry(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if ((err as any)?.code === "MEMBER_PAUSED") {
      setIsPausedError(true);
    } else if ((err as any)?.code === "CHECKOUT_REQUIRED") {
      setError(t("errors.checkoutRequired"));
    } else if ((err as any)?.code === "BILLING_REQUIRED") {
      setError(t("errors.billingRequired"));
    } else if ((err as any)?.code === "ACCESS_DENIED") {
      setError(t("errors.accessDenied"));
    } else {
      // NEVER `err.message`: it is the backend's English, and this screen is
      // in front of a French or Polish counter. The code picks the copy.
      setError(t(redeemErrorKey(err) as never));
      // A generic failure is worth one more tap; a coded refusal is not.
      if (failure === "server") setRetry({ kind: "redeem", instanceId });
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
        screen: {
          flex: 1,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          backgroundColor: theme.background,
        },
        scroll: { flex: 1 },
        header: { paddingHorizontal: 20, paddingTop: 10 },
        // Identity and the way out share one row, so the X has the avatar and
        // the name to align to instead of hanging in empty space.
        headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        // Takes the slack so the name truncates before it can reach the X.
        headerIdentity: { flex: 1, minWidth: 0 },
        closeButton: {
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          // The glyph is centred in a 44pt target, which would leave it 42pt
          // from the screen edge while the avatar starts at 20. Pulling the
          // target out optically lines the X up with the content edge without
          // shrinking it.
          marginRight: -10,
        },
        // Most customers hold no reward, and then there is nothing to scroll:
        // let the card breathe in the middle of the screen. Applied to the CARD
        // zone, not the whole header — centring the header took the customer
        // block down with it, leaving the X aligned to nothing.
        middleFill: { flex: 1 },
        scrollContent: { paddingHorizontal: 20, paddingBottom: 12 },
        actionBar: {
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 8,
          gap: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: blendColors(theme.text, theme.background, 0.86),
          backgroundColor: theme.background,
        },
        topGroup: { gap: 12, paddingBottom: 32 },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 11,
          paddingHorizontal: 16,
          borderRadius: 9999,
          backgroundColor: "#f59e0b",
          alignSelf: "flex-start",
        },
        chipText: { color: "#fff", fontSize: 15, fontWeight: "700" },
        // The card sits in the flexible middle, vertically centered like the
        // points amount, so the controls below never move between screens.
        // Content-sized, not flex:1 — a sticky child cannot absorb slack, and
        // fixed generous padding reads more predictably than stretched space.
        // Opaque, so the rewards list passes underneath rather than through.
        middle: {
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          paddingVertical: 20,
          backgroundColor: theme.background,
        },
        countRow: { flexDirection: "row", alignItems: "flex-end" },
        countBig: { fontSize: 56, fontWeight: "700", color: theme.text, lineHeight: 60 },
        countTotal: {
          fontSize: 22,
          fontWeight: "600",
          color: theme.textSecondary,
          marginLeft: 6,
          marginBottom: 8,
        },
        // Fixed height: the pending line appears and disappears as the quantity
        // changes and must not shove the card up and down.
        pendingRow: { height: 26, justifyContent: "center", alignItems: "center", alignSelf: "stretch" },
        pendingText: { fontSize: 17, fontWeight: "700", color: theme.primaryOnSurface, textAlign: "center" },
        completeText: { fontSize: 17, fontWeight: "700", color: UNLOCK_AMBER, textAlign: "center" },
        // The in-flight line takes the same slot as the quantity line. Quiet
        // and secondary, never red: nothing has gone wrong yet.
        hintText: {
          fontSize: 15,
          fontWeight: "600",
          color: theme.textSecondary,
          textAlign: "center",
        },
        bottomGroup: { gap: 12 },
        stampButton: {
          backgroundColor: theme.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 18,
          borderRadius: 9999,
          width: "100%",
          gap: 12,
        },
        stampButtonText: { color: theme.primaryText, fontSize: 20, fontWeight: "bold" },
        buttonDisabled: { opacity: 0.7 },
        redeemButton: {
          backgroundColor: "#22c55e",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 18,
          borderRadius: 9999,
          width: "100%",
          gap: 12,
        },
        redeemButtonText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
        cancelText: { color: theme.textSecondary, fontSize: 16 },
        skipButton: { padding: 14, alignItems: "center" },
        // A scan the earning limit truncated, and the banner saying so while
        // an override is armed. Amber, not red: nothing went wrong.
        capNote: {
          marginTop: 10,
          fontSize: 13.5,
          lineHeight: 19,
          fontWeight: "600",
          color: UNLOCK_AMBER,
          textAlign: "center",
        },
        overrideNotice: {
          marginTop: 12,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: UNLOCK_TINT,
        },
        overrideNoticeText: {
          fontSize: 13,
          fontWeight: "600",
          color: UNLOCK_AMBER,
          textAlign: "center",
        },
        inlineError: {
          backgroundColor: "#fef2f2",
          padding: 12,
          borderRadius: 8,
          width: "100%",
        },
        inlineErrorText: { color: "#dc2626", textAlign: "center" },
        // Success states: header on top, the card as the centered hero, actions
        // anchored at the bottom.
        successRoot: { flex: 1, width: "100%", alignItems: "center" },
        successHeader: { alignItems: "center", paddingTop: 8 },
        successIcon: {
          width: 72,
          height: 72,
          borderRadius: 36,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        },
        successTitle: {
          fontSize: 24,
          fontWeight: "700",
          color: theme.text,
          marginBottom: 4,
          textAlign: "center",
        },
        successName: { fontSize: 15, color: theme.textSecondary, textAlign: "center" },
        successHero: {
          flex: 1,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        },
        successNote: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
          lineHeight: 24,
        },
        successActions: { width: "100%", gap: 2 },
        rewardPrompt: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
        },
      }),
    [theme]
  );

  // Which control, if any, may offer to re-send. This button redeems the
  // DEFAULT reward, so it may only advertise the default redemption's retry:
  // relabelling it for a NAMED reward would send a different request under the
  // same word. A named reward needs no relabel of its own — its row rebuilds
  // the same fingerprint, so tapping it again reuses that key and IS the
  // retry, which is also how the held-reward rows already behave.
  const retriesAdd = ownsRetry(retry, { kind: "stamp" });
  const retriesDefaultRedeem = ownsRetry(retry, { kind: "redeem", instanceId: null });

  // Shared redeem CTA (same look everywhere; press-scale + medium haptic).
  // Locked while any write is in flight, a stamp included.
  const renderRedeemButton = () => (
    <PressableScale
      style={[styles.redeemButton, inFlight && styles.buttonDisabled]}
      haptic="medium"
      onPress={() => handleRedeemReward()}
      disabled={inFlight}
    >
      {redeeming ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Gift size={24} color="#fff" weight="bold" />
          <Text style={styles.redeemButtonText}>
            {retriesDefaultRedeem ? tCommon("retry") : t("redeemReward")}
          </Text>
        </>
      )}
    </PressableScale>
  );

  /** The count-up counter + the card, shared by every success state. */
  const renderHeroCard = (from: number, to: number, popCount: number) => (
    <>
      <View style={styles.countRow}>
        <AnimatedBalance from={from} to={to} style={styles.countBig} />
        <Text style={styles.countTotal}>/ {totalStamps}</Text>
      </View>
      <StampGrid total={totalStamps} filled={to} popCount={popCount} />
    </>
  );

  // Paused member error — dedicated screen with Go Home action.
  if (isPausedError) {
    return (
      <StatusScreen
        icon={<PauseCircle size={48} color="#fff" weight="fill" />}
        iconColor="#D97706"
        title={t("errors.pausedTitle")}
        message={t("errors.pausedMessage")}
        primary={{ label: t("errors.goHome"), onPress: handleGoHome }}
      />
    );
  }

  // Reward redemption success. A banked redemption (stackable rewards) keeps
  // stamp progress; the classic full-card one resets it.
  if (redeemSuccess && success) {
    const keptStamps = success.stamps > 0;
    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[styles.successIcon, { backgroundColor: SUCCESS_TINT }]}
            >
              {/* No confetti for a redemption we are merely CONFIRMING: the
                  handover already happened, and a second celebration reads as
                  a second reward. */}
              {alreadyCounted ? (
                <Check size={36} color={SUCCESS_GREEN} weight="bold" />
              ) : (
                <Confetti size={36} color={SUCCESS_GREEN} weight="fill" />
              )}
            </Animated.View>
            <Animated.View entering={BODY_ENTER}>
              <Text style={styles.successTitle}>
                {alreadyCounted ? t("success.alreadyRedeemed") : t("success.rewardRedeemed")}
              </Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer.name}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {renderHeroCard(customer.stamps || 0, success.stamps, 0)}
            <Text style={styles.successNote}>
              {keptStamps ? t("success.progressKept", { name: customer.name }) : t("success.collectAgain")}
              {keptStamps && (success.rewards ?? 0) > 0
                ? `\n${rewardsWaitingText(success.rewards ?? 0)}`
                : ""}
            </Text>
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            <PressableScale style={styles.stampButton} onPress={handleDone}>
              <Text style={styles.stampButtonText}>{t("scanNext")}</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Stamp-added success states. All three share the header/hero/actions shape;
  // only the icon, title and the actions differ.
  if (success && !redeemSuccess) {
    const added = success.delta ?? Math.max(0, success.stamps - preStampStamps);
    const rolledOver = success.stamps < totalStamps && (success.rewards ?? 0) > preStampRewards;
    const completed = success.stamps >= totalStamps;
    const earnedReward = rolledOver || completed;
    // After a rollover the counter restarted, so the count-up runs from 0 in the
    // fresh cycle instead of dropping from the old (higher) number.
    const countFrom = rolledOver ? 0 : preStampStamps;
    // A confirmed-after-the-fact success says so, and says it once. The values
    // below it are the fresh ones, so the employee still reads the real card.
    const title = alreadyCounted
      ? t("success.alreadyCounted")
      : rolledOver
        ? t("success.rewardBanked")
        : completed
          ? t("success.cardComplete")
          : success.cap_applied
            ? t("cap.partialTitle")
            : t(`success.stampAdded_${plural(added)}`, { count: added });

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
                    earnedReward && !alreadyCounted ? UNLOCK_TINT : SUCCESS_TINT,
                },
              ]}
            >
              {/* The reward, if there is one, was announced by the request this
                  one repeats. The CTA below still offers it, read off the
                  balance, but the screen does not celebrate it twice. */}
              {earnedReward && !alreadyCounted ? (
                <Confetti size={36} color={UNLOCK_AMBER} weight="fill" />
              ) : (
                <Check size={36} color={SUCCESS_GREEN} weight="bold" />
              )}
            </Animated.View>
            <Animated.View entering={BODY_ENTER}>
              <Text style={styles.successTitle}>{title}</Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer.name}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {renderHeroCard(countFrom, success.stamps, added)}
            {rolledOver && (
              <Text style={styles.successNote}>
                {t("success.rewardBankedFor", { name: customer.name })}
                {"\n"}
                {rewardsWaitingText(success.rewards ?? 0)}
              </Text>
            )}
            {completed && <Text style={styles.successNote}>{t("success.cardFull")}</Text>}
            {success.cap_applied && (
              <Text style={styles.capNote}>
                {t(success.cap_scope === "week" ? "cap.partialWeek" : "cap.partialDay", {
                  added,
                  requested: success.cap_requested ?? added,
                })}
              </Text>
            )}
          </Animated.View>

          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            {completed && <Text style={styles.rewardPrompt}>{t("reward.prompt")}</Text>}
            {earnedReward ? (
              <>
                {renderRedeemButton()}
                {/* Locked while the redemption is in flight, and dimmed to say
                    so — the same treatment the X and Cancel get. Locked with no
                    visual change is a dead control. */}
                <TouchableOpacity
                  style={[styles.skipButton, redeemingDim]}
                  onPress={handleDone}
                  disabled={redeeming}
                >
                  <Text style={styles.cancelText}>
                    {completed ? t("skipForNow") : t("scanNext")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <PressableScale style={styles.stampButton} onPress={handleDone}>
                <Text style={styles.stampButtonText}>{t("scanNext")}</Text>
              </PressableScale>
            )}
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Card is full and waiting on a redemption: no stamps can be added, so the
  // stepper is replaced by the redeem/skip choice.
  // Earning limit reached. Either the snapshot said so before the employee
  // pressed anything, or the request came back 409. Reward-ready wins: a
  // customer with a full card should be offered their reward first.
  const blockingCap =
    capError ??
    (!capOverride && earningCap && earningCap.remaining <= 0
      ? { ...earningCap, can_override: undefined }
      : null);
  if (blockingCap && !isReadyForReward && !success) {
    return (
      <CapBlockedScreen
        customerName={customer.name}
        cap={blockingCap}
        serverAllowsOverride={blockingCap.can_override}
        onOverride={handleWaive}
        overriding={stamping}
        errorMessage={error}
        onDone={handleDone}
        renderRedeemButton={hasBankedRewards ? renderRedeemButton : undefined}
      />
    );
  }

  if (isReadyForReward) {
    return (
      <ConfirmationScaffold>
        <View style={styles.successRoot}>
          <View style={styles.successHeader}>
            <Animated.View
              entering={ICON_ENTER}
              style={[styles.successIcon, { backgroundColor: UNLOCK_TINT }]}
            >
              <Gift size={36} color={UNLOCK_AMBER} weight="fill" />
            </Animated.View>
            <Animated.View entering={BODY_ENTER}>
              <Text style={styles.successTitle}>{t("reward.banner")}</Text>
              <Text style={styles.successName} numberOfLines={1}>
                {customer.name}
              </Text>
            </Animated.View>
          </View>

          <Animated.View entering={DETAIL_ENTER} style={styles.successHero}>
            {renderHeroCard(currentStamps, currentStamps, 0)}
            <Text style={styles.successNote}>{t("reward.entitled")}</Text>
            {error && (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={ACTION_ENTER} style={styles.successActions}>
            {renderRedeemButton()}
            {/* Same as the success screen: locked mid-redemption, and dimmed
                so the lock is visible rather than a tap that does nothing. */}
            <TouchableOpacity
              style={[styles.skipButton, redeemingDim]}
              onPress={handleDone}
              disabled={redeeming}
            >
              <Text style={styles.cancelText}>{t("skipForNow")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ConfirmationScaffold>
    );
  }

  // Entry state: set the quantity, watch the card fill, commit in one press.
  return (
    <SafeAreaView style={styles.screen}>
      {/* Everything above the action bar scrolls. With five held rewards the
          old fixed layout had nowhere to put them: `middle` collapsed to zero
          and the stamp grid drew on top of the rewards chip. */}
      {/* Three zones: who + progress pinned at the top, rewards scrolling in
          the middle, stamping pinned at the bottom. Tried RN's
          stickyHeaderIndices first — it re-positions the pinned child over the
          list rather than at the top, so the progress row simply lives outside
          the ScrollView instead. */}
      {/* Leaving lives on the customer's own row. It used to be a full-width
          "Cancel" at the foot of the action bar, which cost ~56pt of the one
          thing this screen is short of — room for the rewards list — to say
          what the X says in the corner. On a row of its own it had nothing to
          align to and read as floating. */}
      <View style={styles.header}>
        <View style={styles.topGroup}>
          <View style={styles.headerRow}>
            {/* min-w-0 equivalent: the name truncates before it reaches the X,
                so a long one can never push the close button off. */}
            <View style={styles.headerIdentity}>
              <CustomerHeader
                name={customer.name}
                balance={t("stampsCount", { current: currentStamps, total: totalStamps })}
                loading={false}
              />
            </View>
            {/* Locked while a request is in flight. Walking out here and
                rescanning would mint a new key for the same scan, and the
                customer would be stamped twice. */}
            <PressableScale
              style={[styles.closeButton, lockedDim]}
              haptic="light"
              onPress={handleDone}
              disabled={inFlight}
              accessibilityRole="button"
              accessibilityLabel={tCommon("close")}
            >
              <X size={22} color={theme.textSecondary} weight="bold" />
            </PressableScale>
          </View>
          {/* Only when the list below CANNOT name them. A count above a list
              that shows each reward by name, with its own deadline and its own
              button, is the same fact written twice — and it cost a row of
              scroll to say the weaker half. The fallback path (an API that
              sent no instance list) has nothing but the count, so it keeps it. */}
          {hasBankedRewards && heldRewards.length === 0 && (
            <Animated.View entering={SOFT_ENTER} style={styles.chip}>
              <Gift size={18} color="#fff" weight="fill" />
              <Text style={styles.chipText}>
                {t(`rewardsBadge_${plural(rewards)}`, { count: rewards })}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Outside the header so the identity row above stays pinned while THIS
          zone is the one that absorbs slack. Centring the header as a whole
          used to float the customer block down the screen with the card. */}
      <View style={[styles.middle, !hasBankedRewards && styles.middleFill]}>
          <StampGrid total={totalStamps} filled={currentStamps} pending={quantity} />
          <View style={styles.pendingRow}>
            {/* Keyed so the line re-animates as the promise changes, and the
                "completes the card" beat lands the moment it becomes true.
                The in-flight hint borrows this same fixed-height slot, so a
                slow network moves nothing on the screen. */}
            <Animated.Text
              key={hintKey ?? (willCompleteCard ? "complete" : `pending-${quantity}`)}
              entering={FadeIn.duration(160)}
              // The slot is a fixed 26pt so nothing shifts. The hint lines are
              // twice the length of the quantity line they replace, so at a
              // large system text size they wrap out of it and paint over the
              // card above and the notices below. One line, ellipsised.
              numberOfLines={1}
              style={
                hintKey
                  ? styles.hintText
                  : willCompleteCard
                    ? styles.completeText
                    : styles.pendingText
              }
            >
              {hintKey
                ? t(hintKey as never)
                : willCompleteCard
                  ? t("quantity.completesCard")
                  : t(`quantity.pending_${plural(quantity)}`, { count: quantity })}
            </Animated.Text>
          </View>
          {capOverride && (
            <Animated.View entering={SOFT_ENTER} style={styles.overrideNotice}>
              <Text style={styles.overrideNoticeText}>{t("cap.overrideActiveNotice")}</Text>
            </Animated.View>
          )}
          {error && (
            <Animated.View entering={SOFT_ENTER} style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </Animated.View>
          )}
      </View>

      {/* Named rewards the customer holds, one row each so the employee
          hands over the right thing. Falls back to the single generic
          redeem CTA when the backend sent no instance list (older API). */}
      {hasBankedRewards && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {heldRewards.length > 0 ? (
            <HeldRewardsList
              rewards={heldRewards}
              onRedeem={handleRedeemReward}
              redeemingId={redeemingId}
              disabled={inFlight}
            />
          ) : (
            renderRedeemButton()
          )}
        </ScrollView>
      )}

      {/* Stamping is the reason this screen exists, so it stays put at the
          bottom no matter how many rewards are listed above it. */}
      <View style={styles.actionBar}>
        <StampStepper
          value={quantity}
          max={maxQuantity}
          onChange={setQuantity}
          disabled={stamping || redeeming}
        />

        <PressableScale
          style={[styles.stampButton, stamping && styles.buttonDisabled]}
          haptic="medium"
          onPress={() => handleAddStamp()}
          disabled={stamping || redeeming}
        >
          {stamping ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Animated.Text
              key={retriesAdd ? "retry" : quantity}
              entering={FadeIn.duration(140)}
              style={styles.stampButtonText}
            >
              {/* Same button, same place under the thumb. It sends the same
                  body with the same key, so pressing it cannot double-credit
                  even if the first attempt did land. */}
              {retriesAdd
                ? tCommon("retry")
                : t(`addStamp_${plural(quantity)}`, { count: quantity })}
            </Animated.Text>
          )}
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
