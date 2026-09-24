import { apiFetch, MUTATION_TIMEOUT_MS, type ApiFetchConfig } from "./client";
import { buildRedeemBody, buildStampBody } from "./scanRequests";
import { mapRedeemError, mapStampError } from "./scanErrors";
import type { Customer, StampResponse } from "../types/api";

/**
 * The two counter mutations.
 *
 * Both go through `apiFetch`, which is what gives them a request budget, an
 * abort, and one silent session refresh on a 401 (STA-340). Before that they
 * called `fetch` bare: a slow backend was a frozen screen with a customer
 * waiting, and the employee's only move was to tap again.
 *
 * `clientKey` is the idempotency key for THIS request; the same key on a retry
 * means the backend replays the original answer instead of crediting twice.
 * See `api/idempotency.ts` for when a key is reused and when a new one is
 * minted. It is optional throughout: a build that sends none behaves exactly
 * as every build before it did.
 *
 * The bodies are built in `scanRequests`, the errors mapped in `scanErrors` —
 * both pure, both unit tested, neither reachable from here at test time
 * because this module imports react-native through the client.
 */

export async function getCustomer(
  businessId: string,
  customerId: string,
  /**
   * Override the read budget. The reconcile passes the MUTATION budget: it
   * runs after a scan has already spent 8s, and a till cannot be held for the
   * sum of both while an employee waits to learn whether a stamp landed.
   */
  config: ApiFetchConfig = {}
): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${businessId}/${customerId}`, {}, config);
}

export async function addStamp(
  businessId: string,
  enrollmentId: string,
  locationId?: string | null,
  /** Stamps this one scan is worth (the stepper). Omitted when 1. */
  quantity?: number,
  /** Owner/admin decision to push past a reached earning cap. Omitted unless true. */
  capOverride?: boolean,
  /** Idempotency key. The same key on a retry credits once, not twice. */
  clientKey?: string | null
): Promise<StampResponse> {
  const body = buildStampBody({ locationId, quantity, capOverride, clientKey });

  try {
    return await apiFetch<StampResponse>(
      `/stamps/${businessId}/${enrollmentId}`,
      { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) },
      { timeoutMs: MUTATION_TIMEOUT_MS }
    );
  } catch (err) {
    throw mapStampError(err);
  }
}

export async function redeemReward(
  businessId: string,
  enrollmentId: string,
  locationId?: string | null,
  rewardId?: string | null,
  customerRewardId?: string | null,
  /** Idempotency key. A replayed redemption hands over one reward, not two. */
  clientKey?: string | null
): Promise<StampResponse> {
  const body = buildRedeemBody({ locationId, rewardId, customerRewardId, clientKey });

  try {
    return await apiFetch<StampResponse>(
      `/stamps/${businessId}/${enrollmentId}/redeem`,
      { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) },
      { timeoutMs: MUTATION_TIMEOUT_MS }
    );
  } catch (err) {
    throw mapRedeemError(err);
  }
}
