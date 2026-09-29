import { apiFetch, MUTATION_TIMEOUT_MS } from "./client";
import { buildPointsBody } from "./scanRequests";
import { mapPointsError } from "./scanErrors";
import type { StampResponse } from "../types/api";

/**
 * Add points to a points-program enrollment.
 *
 * POST /stamps/{biz}/{enrollment} with {amount, location_id?}. `amount` is the
 * ticket price the employee entered; the backend converts it to points
 * (round(amount * points_per_currency_unit)). Mirrors addStamp's error-code
 * handling and adds AMOUNT_REQUIRED as a safety net (it should never fire from
 * this path since we always send an amount, but it guards against a misrouted
 * call / stale build).
 *
 * Goes through `apiFetch` on the mutation budget, so a slow backend becomes an
 * outcome the keypad can act on rather than a spinner nobody can leave
 * (STA-340). `clientKey` makes the retry of an unanswered request safe: the
 * backend replays the original instead of adding the ticket twice.
 */
export async function addPoints(
  businessId: string,
  enrollmentId: string,
  amount: number,
  locationId?: string | null,
  /** Owner/admin decision to push past a reached earning cap. Omitted unless true. */
  capOverride?: boolean,
  /** Idempotency key. The same key on a retry credits once, not twice. */
  clientKey?: string | null
): Promise<StampResponse> {
  const body = buildPointsBody({ amount, locationId, capOverride, clientKey });

  try {
    return await apiFetch<StampResponse>(
      `/stamps/${businessId}/${enrollmentId}`,
      { method: "POST", body: JSON.stringify(body) },
      { timeoutMs: MUTATION_TIMEOUT_MS }
    );
  } catch (err) {
    throw mapPointsError(err);
  }
}
