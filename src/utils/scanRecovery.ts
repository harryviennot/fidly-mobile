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

import type { Customer } from "../types/api";

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

/** The pre-action snapshot, per action, of exactly what that action moves. */
export type ReconcileTarget =
  | { action: "stamp"; stamps: number; rewards: number }
  | { action: "points"; balance: number }
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
    // Either side moving is a credit. A multi-stamp scan that rolls the card
    // over ends BELOW where it started with a reward banked, so comparing the
    // stamp count alone would tell the employee to stamp again.
    const credited = after.stamps > before.stamps || rewardCount(after) > before.rewards;
    return credited ? "credited" : "unchanged";
  }

  if (before.action === "points") {
    return balanceOf(after) > before.balance ? "credited" : "unchanged";
  }

  // A named instance is the precise signal: it is gone or it is not.
  const instances = after.program?.banked_rewards;
  if (before.instanceId && Array.isArray(instances)) {
    const stillHeld = instances.some((reward) => reward.id === before.instanceId);
    return stillHeld ? "unchanged" : "credited";
  }

  // No instance named, or a backend that sends none: the classic full card
  // resets to zero, a menu redemption spends points, a banked one drops the
  // count.
  const spent =
    rewardCount(after) < before.rewards ||
    balanceOf(after) < before.balance ||
    after.stamps < before.stamps;
  return spent ? "credited" : "unchanged";
}
