import { apiFetch, getAuthHeaders, API_BASE_URL } from "./client";
import { ApiError, toApiError } from "./errors";
import type { Customer, StampResponse } from "../types/api";

/**
 * Throw a CODE, never a sentence.
 *
 * Every string thrown from this file used to be English, and the screens
 * rendered `err.message` straight into the banner — so a French counter got
 * "Failed to redeem reward". Message and code are the same token here, so even
 * a careless render shows something obviously untranslated rather than
 * plausible English. See utils/apiErrors for the code -> copy mapping.
 */
function coded(code: string, status: number): ApiError {
  return new ApiError(code, status, code);
}


export async function getCustomer(businessId: string, customerId: string): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${businessId}/${customerId}`);
}

export async function addStamp(
  businessId: string,
  enrollmentId: string,
  locationId?: string | null,
  /** Stamps this one scan is worth (the stepper). Omitted when 1. */
  quantity?: number,
  /** Owner/admin decision to push past a reached earning cap. Omitted unless true. */
  capOverride?: boolean
): Promise<StampResponse> {
  const headers = getAuthHeaders();

  // Only send a body when there's something to say. Single-location and non-Pro
  // businesses omit the location and the backend auto-assigns (or records
  // NULL); quantity is omitted at 1 so a plain single stamp stays byte-identical
  // on the wire to what every previous build sent.
  const init: RequestInit = { method: "POST", headers };
  const reqBody: Record<string, unknown> = {};
  if (locationId) reqBody.location_id = locationId;
  if (quantity != null && quantity > 1) reqBody.quantity = quantity;
  if (capOverride) reqBody.cap_override = true;
  if (Object.keys(reqBody).length > 0) {
    init.body = JSON.stringify(reqBody);
  }

  const response = await fetch(
    `${API_BASE_URL}/stamps/${businessId}/${enrollmentId}`,
    init
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw coded("UNAUTHORIZED", 401);
    }
    const body = await response.json().catch(() => ({}));
    const code: string | undefined = body?.detail?.code;
    // Re-raise backend codes the UI handles explicitly (member pause, billing
    // pause, location resolution failures, the card-upfront checkout gate, and
    // AMOUNT_REQUIRED, a bodiless stamp call hitting a program that converted
    // to points). The screen maps these to localized messages.
    if (
      code === "MEMBER_PAUSED" ||
      code === "CHECKOUT_REQUIRED" ||
      code === "BILLING_REQUIRED" ||
      code === "LOCATION_REQUIRED" ||
      code === "LOCATION_NOT_PERMITTED" ||
      code === "LOCATION_NOT_FOUND" ||
      code === "AMOUNT_REQUIRED" ||
      code === "EARNING_CAP_REACHED" ||
      code === "CAP_OVERRIDE_NOT_ALLOWED"
    ) {
      const err = new Error(code);
      (err as any).code = code;
      // The cap payload carries which window is full, when it frees up, and
      // whether this user may override — the screen needs all three.
      (err as any).detail = body?.detail;
      throw err;
    }
    if (response.status === 403) {
      // Not a billing pause: a real permissions problem. Coded so the screen
      // can localize it rather than showing this English fallback.
      const err = new Error("ACCESS_DENIED");
      (err as any).code = "ACCESS_DENIED";
      throw err;
    }
    if (response.status === 404) {
      throw coded("ENROLLMENT_NOT_FOUND", 404);
    }
    throw coded("STAMP_FAILED", response.status);
  }

  return response.json();
}

export async function redeemReward(
  businessId: string,
  enrollmentId: string,
  locationId?: string | null,
  rewardId?: string | null,
  customerRewardId?: string | null
): Promise<StampResponse> {
  const headers = getAuthHeaders();

  // Tag the redemption with the lobby-selected location (mirrors addStamp) and,
  // for multi-reward programs (the points menu), the chosen reward_id. Lenient
  // server-side: omitting location records NULL; omitting reward_id claims the
  // natural default. Send a body whenever either is present.
  //
  // customer_reward_id names ONE reward the customer already holds (STA-264).
  // It is the only way to redeem a granted item, which has no ladder entry for
  // reward_id to point at, and it stops a mis-tap spending the wrong gift.
  const init: RequestInit = { method: "POST", headers };
  const reqBody: Record<string, unknown> = {};
  if (locationId) reqBody.location_id = locationId;
  if (rewardId) reqBody.reward_id = rewardId;
  if (customerRewardId) reqBody.customer_reward_id = customerRewardId;
  if (Object.keys(reqBody).length > 0) {
    init.body = JSON.stringify(reqBody);
  }

  const response = await fetch(
    `${API_BASE_URL}/stamps/${businessId}/${enrollmentId}/redeem`,
    init
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw coded("UNAUTHORIZED", 401);
    }
    // Card-upfront checkout gate (402) and billing pause (403): re-raise so the
    // screen can explain what the owner needs to do.
    if (response.status === 402 || response.status === 403) {
      const body = await response.json().catch(() => ({}));
      const code: string | undefined = body?.detail?.code;
      if (
        code === "CHECKOUT_REQUIRED" ||
        code === "BILLING_REQUIRED" ||
        code === "MEMBER_PAUSED"
      ) {
        const err = new Error(code);
        (err as any).code = code;
        throw err;
      }
      if (response.status === 403) {
        const err = new Error("ACCESS_DENIED");
        (err as any).code = "ACCESS_DENIED";
        throw err;
      }
    }
    if (response.status === 404) {
      throw coded("ENROLLMENT_NOT_FOUND", 404);
    }
    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      // The backend answers a refused redemption with {code, message}. This
      // used to do `new Error(error.detail)` on that object, which renders as
      // "[object Object]" — and before that it never got here at all, because
      // the route 500ed on a missing import. Both are why an expired reward
      // showed a generic red banner instead of saying it had expired.
      const err = toApiError(body, 400, "NOT_ELIGIBLE");
      // The only plain-string 400 this route raises is "Not eligible for
      // redemption", which arrives with no code. Give it one so the screen can
      // say something better than "it failed".
      throw err.code ? err : coded("NOT_ELIGIBLE", 400);
    }
    throw coded("REDEEM_FAILED", response.status);
  }

  return response.json();
}
