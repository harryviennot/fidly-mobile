/**
 * Turning a failed API call into something an employee can read.
 *
 * Two rules the scanner kept breaking:
 *
 * 1. **The API client throws CODES, never prose.** It used to throw English
 *    sentences ("Failed to redeem reward", "Enrollment not found") which the
 *    screens rendered verbatim — English banners on a French counter. A code
 *    has to be translated before it can be shown, so the compiler-less path of
 *    least resistance is now the correct one.
 * 2. **`err.message` is never rendered.** It is the code. Screens resolve it
 *    through here.
 */

import { NETWORK_UNREACHABLE, REQUEST_TIMEOUT } from '@/api/errors';

/** The code an error carries, if it is one of ours.
 *
 *  Works on `ApiError` (which has `code`) and on any error the API client
 *  tagged by hand. Parsing the wire `detail` is `toApiError`'s job, not this
 *  module's — one parser for one format. */
export function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && code) return code;
  }
  return undefined;
}

/** Codes the redeem route can answer with, mapped to their `stamp.errors.*` key. */
const REDEEM_ERROR_KEYS: Record<string, string> = {
  REWARD_UNAVAILABLE: 'errors.rewardUnavailable',
  NOT_ELIGIBLE: 'errors.notEligible',
  // Same remedy for the employee either way: the card the scanner is holding
  // is not one the server can act on, so have the customer reopen it.
  ENROLLMENT_NOT_FOUND: 'errors.cardNotRecognised',
  CUSTOMER_NOT_FOUND: 'errors.cardNotRecognised',
  UNAUTHORIZED: 'errors.unauthorized',
  CHECKOUT_REQUIRED: 'errors.checkoutRequired',
  BILLING_REQUIRED: 'errors.billingRequired',
  ACCESS_DENIED: 'errors.accessDenied',
};

/**
 * The translation key to show for a failed redemption.
 *
 * Falls back to the generic failure rather than to the server's own words: the
 * backend speaks English, and the employee is standing at a French counter
 * with a customer waiting. An untranslated sentence is worse than a vague one.
 */
export function redeemErrorKey(err: unknown): string {
  const code = errorCode(err);
  return (code && REDEEM_ERROR_KEYS[code]) || 'errors.redeemFailed';
}

/** Same, for the stamp route. */
const STAMP_ERROR_KEYS: Record<string, string> = {
  ...REDEEM_ERROR_KEYS,
  AMOUNT_REQUIRED: 'errors.programNowPoints',
};

export function stampErrorKey(err: unknown): string {
  const code = errorCode(err);
  return (code && STAMP_ERROR_KEYS[code]) || 'errors.stampFailed';
}

/** What kind of recovery a failed counter mutation deserves. */
export type MutationFailure =
  /** The backend refused on purpose and the screen already says why. */
  | 'gate'
  /**
   * Sent, and no answer from the backend itself: none inside the budget, or a
   * gateway's 502/503/504 in its place. It may have landed: re-read before
   * saying anything.
   */
  | 'timeout'
  /** Never left the phone. Nothing to reconcile; retrying is safe. */
  | 'offline'
  /** One key, two different requests — our bug, and never a retry loop. */
  | 'conflict'
  /** Failed without deciding anything. Worth one more tap with the same key. */
  | 'server';

/** A proxy answering because the backend did not: the write may be committed. */
export function isGatewayStatus(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Coded, but not refusals: the route ladders' own generic fallbacks, and a
 * redeem that lost its compare-and-swap to a concurrent change and wrote
 * nothing.
 */
const RETRYABLE_CODES = new Set(['STAMP_FAILED', 'REDEEM_FAILED', 'PROGRESS_CHANGED']);

export function classifyMutationFailure(err: unknown): MutationFailure {
  const code = errorCode(err);
  if (code === REQUEST_TIMEOUT) return 'timeout';
  if (code === NETWORK_UNREACHABLE) return 'offline';
  if (code === 'CLIENT_KEY_CONFLICT') return 'conflict';
  const status = errorStatus(err);
  if (isGatewayStatus(status)) return 'timeout';
  if (status != null && status >= 500) return 'server';
  if (code && RETRYABLE_CODES.has(code)) return 'server';
  // Any other coded refusal is a gate, including one this build has never
  // heard of: the ladder's generic copy covers it, and a Retry would only
  // fetch the same refusal again.
  if (code) return 'gate';
  return 'server';
}

/** The HTTP status an `ApiError` carries, if it is one. */
export function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/**
 * Same, for loading a scanned customer.
 *
 * Falls back through the STATUS as well as the code, because FastAPI's own
 * 404s and 401s answer with a plain-string `detail` and therefore carry no
 * code at all — and that string is English ("Customer not found"), which is
 * exactly what used to reach a French counter.
 */
export function loadErrorKey(err: unknown): string {
  const code = errorCode(err);
  if (code && REDEEM_ERROR_KEYS[code]) return REDEEM_ERROR_KEYS[code];
  const status = errorStatus(err);
  if (status === 404) return 'errors.cardNotRecognised';
  if (status === 401 || status === 403) return 'errors.unauthorized';
  return 'errors.loadFailed';
}
