/**
 * What the scanner does when a scan does not answer.
 *
 * A counter mutation that times out is the one failure the employee cannot
 * resolve by looking at the screen: the request may have credited the customer
 * and lost its answer, or never arrived at all. Guessing either way is a bug —
 * "it failed" invites a second scan that double-credits, "it worked" hands out
 * a reward nobody recorded.
 *
 * So the scanner does not guess. It re-reads the customer ONCE and compares the
 * field the action was supposed to move. This module is that comparison, kept
 * pure and free of React Native so it can be unit tested (see the note in
 * `src/locales/i18n-catalogs.test.ts`).
 *
 * Where the answer is genuinely ambiguous, the verdict leans `unchanged`. That
 * costs at most one extra tap, and the tap is free: the retry carries the same
 * `client_key`, so the backend replays the original rather than crediting
 * twice. Leaning the other way would silently swallow a scan.
 */

import type { Customer, StampResponse } from "../types/api";

/** Long enough that a healthy scan never shows a hint, short enough to answer
 *  "is this thing doing anything?" before the employee taps again. */
export const SLOW_HINT_AFTER_MS = 3000;

export type ScanPhase =
  /** Nothing in flight. */
  | "idle"
  /** Sent, still inside the quiet window. */
  | "submitting"
  /** Taking longer than it should. */
  | "slow"
  /** It timed out; we are re-reading the customer to find out what happened. */
  | "confirming";

/** The `stamp.errors.*` / `points.errors.*` key for the in-flight hint line. */
export function hintKeyForPhase(phase: ScanPhase): string | null {
  if (phase === "slow") return "errors.slowNetwork";
  if (phase === "confirming") return "errors.confirming";
  return null;
}

/**
 * How many rewards the customer holds.
 *
 * Instances first, scalar second: `banked_rewards` is the truth since STA-264,
 * and `rewards` is the legacy mirror kept for backends that predate it.
 */
export function rewardCount(customer: Customer): number {
  const instances = customer.program?.banked_rewards;
  if (Array.isArray(instances)) return instances.length;
  return customer.rewards ?? 0;
}

function balanceOf(customer: Customer): number {
  return customer.program?.primary_value ?? customer.stamps;
}

/**
 * The banner for a reconcile that did not end in a credit.
 *
 * The distinction is the whole point of reconciling. `unchanged` means we
 * looked and the scan is definitely not there, so the screen can say nothing
 * was recorded. `unknown` means the re-read failed too, and claiming the scan
 * did not land would be a guess the employee then acts on: that copy promises
 * only that trying again is safe, which the client key is what guarantees.
 */
export function recoveryErrorKey(verdict: ReconcileVerdict): string {
  return verdict === "unknown" ? "errors.offline" : "errors.timedOut";
}

/** The pre-action snapshot, per action, of exactly what that action moves. */
export type ReconcileTarget =
  | {
      action: "stamp";
      stamps: number;
      rewards: number;
      /** Stamps THIS request asked for. Movement that is not this is not ours. */
      expected: number;
    }
  | {
      action: "points";
      balance: number;
      /** Points this ticket was previewed to be worth, or null when unknown. */
      expected: number | null;
    }
  | {
      action: "redeem";
      /** The instance the employee tapped, when they named one. */
      instanceId: string | null;
      stamps: number;
      rewards: number;
      balance: number;
    };

export type ReconcileVerdict =
  /** It landed. Show the "already counted" success. */
  | "credited"
  /** It did not land. Back to the entry state, with Retry. */
  | "unchanged"
  /** The re-read failed too, so we know nothing and must claim nothing. */
  | "unknown";

export function reconcileVerdict(
  before: ReconcileTarget,
  after: Customer | null
): ReconcileVerdict {
  if (!after) return "unknown";

  if (before.action === "stamp") {
    const stampsMoved = after.stamps !== before.stamps;
    const rewardsMoved = rewardCount(after) !== before.rewards;
    if (!stampsMoved && !rewardsMoved) return "unchanged";
    // Movement alone proves nothing: a second till stamping this customer
    // moves the same number. Only movement that is EXACTLY what this request
    // asked for is ours to claim. Everything else (a rollover, a cap-clamped
    // scan, another device) is unattributable, and the retry settles it.
    if (after.stamps === before.stamps + before.expected && !rewardsMoved) {
      return "credited";
    }
    return "unknown";
  }

  if (before.action === "points") {
    const balance = balanceOf(after);
    if (balance === before.balance) return "unchanged";
    if (before.expected != null && balance === before.balance + before.expected) {
      return "credited";
    }
    return "unknown";
  }

  // A named instance is the one precise signal in the whole reconcile: that
  // reward is gone or it is not, and either way exactly one of it was handed
  // over.
  const instances = after.program?.banked_rewards;
  if (before.instanceId && Array.isArray(instances)) {
    const stillHeld = instances.some((reward) => reward.id === before.instanceId);
    return stillHeld ? "unchanged" : "credited";
  }

  // Nothing names what we spent. A full card that reset, a balance that fell,
  // a count that dropped: every one of those is equally the OTHER till's
  // redemption, and calling it ours hands the customer a second reward for one
  // full card. Never credited here. The same-key retry is what settles it: the
  // backend replays ours, or performs it, or refuses because the reward is
  // genuinely gone.
  const moved =
    after.stamps !== before.stamps ||
    rewardCount(after) !== before.rewards ||
    balanceOf(after) !== before.balance;
  return moved ? "unknown" : "unchanged";
}

/**
 * The success payload a reconciled scan renders from.
 *
 * Built entirely from the FRESH snapshot, and deliberately carries no `delta`:
 * nothing here knows what this request added, only where the customer now
 * stands. The screen counts up to these values from the pre-action snapshot it
 * captured before pressing send.
 */
export function reconciledResponse(fresh: Customer): StampResponse {
  return {
    customer_id: fresh.id,
    name: fresh.name,
    stamps: fresh.stamps,
    value_after: balanceOf(fresh),
    rewards: rewardCount(fresh),
    message: "",
  };
}

/**
 * Which operation a pending Retry would re-send.
 *
 * A Retry is not a mood, it is one specific request with one specific key. The
 * first cut of this stage stored a bare boolean, and a timed-out REDEEM
 * relabelled the Add button: pressing "Retry" stamped the card instead of
 * handing over the reward it had just failed to hand over. A control may only
 * advertise a retry it can actually perform.
 */
export type RetryTarget =
  | { kind: "stamp" }
  | { kind: "points" }
  | { kind: "redeem"; instanceId: string | null };

/** Does THIS control own the pending retry? */
export function ownsRetry(target: RetryTarget | null, control: RetryTarget): boolean {
  if (!target || target.kind !== control.kind) return false;
  // Two redeem controls can be on screen at once (the generic CTA, and a named
  // reward's own row). Only the one that failed may offer to re-send.
  if (target.kind === "redeem" && control.kind === "redeem") {
    return target.instanceId === control.instanceId;
  }
  return true;
}
