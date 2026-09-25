/**
 * Turning what the transport threw into the codes the screens branch on.
 *
 * Throw a CODE, never a sentence. Every string these routes used to throw was
 * English, and the screens rendered it straight into the banner — so a French
 * counter got "Failed to redeem reward". Message and code are the same token
 * here, so even a careless render shows something obviously untranslated rather
 * than plausible English. See `utils/apiErrors` for the code -> copy mapping.
 *
 * Routing the mutations through `apiFetch` (STA-340) moved this mapping off the
 * raw `Response` and onto the `ApiError` the shared client raises. The ladders
 * below are the ones that already shipped, code for code and status for status
 * — a coded gate must behave exactly as it did before this stage.
 */

import {
  ApiError,
  NETWORK_UNREACHABLE,
  REQUEST_TIMEOUT,
} from "./errors";
import { errorCode, errorStatus, isGatewayStatus } from "@/utils/apiErrors";

/**
 * Verdicts that are not this module's to translate.
 *
 * The two transport ones decide which recovery the screen offers, and the
 * conflict is a bug of ours that must stay legible rather than being flattened
 * into "couldn't add stamp".
 */
const PASS_THROUGH = new Set([REQUEST_TIMEOUT, NETWORK_UNREACHABLE, "CLIENT_KEY_CONFLICT"]);

/** Gates the stamp route answers with, each of which the screen explains. */
const STAMP_GATES = new Set([
  "MEMBER_PAUSED",
  "CHECKOUT_REQUIRED",
  "BILLING_REQUIRED",
  "LOCATION_REQUIRED",
  "LOCATION_NOT_PERMITTED",
  "LOCATION_NOT_FOUND",
  "AMOUNT_REQUIRED",
  "EARNING_CAP_REACHED",
  "CAP_OVERRIDE_NOT_ALLOWED",
]);

/** The redeem route has no cap and no amount; these three are all it gates on. */
const REDEEM_GATES = new Set(["CHECKOUT_REQUIRED", "BILLING_REQUIRED", "MEMBER_PAUSED"]);

/** Same set as the stamp route: the keypad posts to the same endpoint. */
const POINTS_GATES = STAMP_GATES;

function coded(code: string, status: number): ApiError {
  return new ApiError(code, status, code);
}

/**
 * Re-raise a gate as its code, keeping the payload.
 *
 * The cap payload carries which window is full, when it frees up, and whether
 * this user may override — the blocked screen is built out of all three.
 */
function codedGate(err: unknown, code: string): ApiError {
  const detail = err instanceof ApiError ? err.detail : undefined;
  return new ApiError(code, errorStatus(err) ?? 0, code, detail);
}

function passesThrough(err: unknown): boolean {
  const code = errorCode(err);
  return code != null && PASS_THROUGH.has(code);
}

export function mapStampError(err: unknown): Error {
  if (passesThrough(err)) return err as Error;

  const code = errorCode(err);
  const status = errorStatus(err);

  if (status === 401) return coded("UNAUTHORIZED", 401);
  if (code && STAMP_GATES.has(code)) return codedGate(err, code);
  // Not a billing pause: a real permissions problem. Coded so the screen can
  // localize it rather than showing the backend's English.
  if (status === 403) return coded("ACCESS_DENIED", 403);
  if (status === 404) return coded("ENROLLMENT_NOT_FOUND", 404);
  return coded("STAMP_FAILED", status ?? 0);
}

export function mapRedeemError(err: unknown): Error {
  if (passesThrough(err)) return err as Error;

  const code = errorCode(err);
  const status = errorStatus(err);

  if (status === 401) return coded("UNAUTHORIZED", 401);
  // Card-upfront checkout gate (402) and billing pause (403).
  if ((status === 402 || status === 403) && code && REDEEM_GATES.has(code)) {
    return codedGate(err, code);
  }
  if (status === 403) return coded("ACCESS_DENIED", 403);
  if (status === 404) return coded("ENROLLMENT_NOT_FOUND", 404);
  // The redeem lost its compare-and-swap to a concurrent change and wrote
  // nothing. Kept by name so the screen offers Retry with the same key.
  if (code === "PROGRESS_CHANGED") return coded(code, status ?? 0);
  if (status === 400) {
    // The backend answers a refused redemption with {code, message} — an
    // expired reward says so, instead of showing a generic red banner. The
    // only plain-string 400 this route raises is "Not eligible for
    // redemption", which arrives with no code at all; give it one so the
    // screen can say something better than "it failed".
    return code ? (err as Error) : coded("NOT_ELIGIBLE", 400);
  }
  return coded("REDEEM_FAILED", status ?? 0);
}

/**
 * The points keypad's ladder.
 *
 * The three uncoded failures below are kept uncoded ON PURPOSE. `PointsFlow`
 * answers an unmapped error with its own `errors.addFailed` copy, so these
 * never reach a customer-facing string; coding them would quietly change which
 * banner the employee reads (a 401 would start claiming the session expired),
 * and that is not this stage's business.
 */
export function mapPointsError(err: unknown): Error {
  if (passesThrough(err)) return err as Error;

  const code = errorCode(err);
  const status = errorStatus(err);

  if (status === 401) return new Error("Not authorized to add points");
  if (code && POINTS_GATES.has(code)) return codedGate(err, code);
  if (status === 403) return coded("ACCESS_DENIED", 403);
  if (status === 404) return new Error("Enrollment not found");
  // Still uncoded, but a gateway's status is kept: the add may have committed
  // behind it, so the screen re-reads the customer instead of just retrying.
  if (isGatewayStatus(status)) return new ApiError("Failed to add points", status ?? 0);
  return new Error("Failed to add points");
}
