import { apiFetch, getAuthHeaders, API_BASE_URL } from "./client";
import type { Customer, StampResponse } from "../types/api";

export async function getCustomer(businessId: string, customerId: string): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${businessId}/${customerId}`);
}

export async function addStamp(
  businessId: string,
  enrollmentId: string,
  locationId?: string | null,
  /** Stamps this one scan is worth (the stepper). Omitted when 1. */
  quantity?: number
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
  if (Object.keys(reqBody).length > 0) {
    init.body = JSON.stringify(reqBody);
  }

  const response = await fetch(
    `${API_BASE_URL}/stamps/${businessId}/${enrollmentId}`,
    init
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authorized to add stamps");
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
      code === "AMOUNT_REQUIRED"
    ) {
      const err = new Error(code);
      (err as any).code = code;
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
      throw new Error("Enrollment not found");
    }
    throw new Error("Failed to add stamp");
  }

  return response.json();
}

export async function redeemReward(
  businessId: string,
  enrollmentId: string,
  locationId?: string | null,
  rewardId?: string | null
): Promise<StampResponse> {
  const headers = getAuthHeaders();

  // Tag the redemption with the lobby-selected location (mirrors addStamp) and,
  // for multi-reward programs (the points menu), the chosen reward_id. Lenient
  // server-side: omitting location records NULL; omitting reward_id claims the
  // natural default. Send a body whenever either is present.
  const init: RequestInit = { method: "POST", headers };
  const reqBody: Record<string, unknown> = {};
  if (locationId) reqBody.location_id = locationId;
  if (rewardId) reqBody.reward_id = rewardId;
  if (Object.keys(reqBody).length > 0) {
    init.body = JSON.stringify(reqBody);
  }

  const response = await fetch(
    `${API_BASE_URL}/stamps/${businessId}/${enrollmentId}/redeem`,
    init
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authorized to redeem rewards");
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
      throw new Error("Enrollment not found");
    }
    if (response.status === 400) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Customer not ready for reward");
    }
    throw new Error("Failed to redeem reward");
  }

  return response.json();
}
