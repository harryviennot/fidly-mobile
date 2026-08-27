import { getAuthHeaders, API_BASE_URL } from "./client";
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
 */
export async function addPoints(
  businessId: string,
  enrollmentId: string,
  amount: number,
  locationId?: string | null,
  /** Owner/admin decision to push past a reached earning cap. Omitted unless true. */
  capOverride?: boolean
): Promise<StampResponse> {
  const headers = getAuthHeaders();

  const body: Record<string, unknown> = { amount };
  if (locationId) body.location_id = locationId;
  if (capOverride) body.cap_override = true;

  const response = await fetch(
    `${API_BASE_URL}/stamps/${businessId}/${enrollmentId}`,
    { method: "POST", headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authorized to add points");
    }
    const payload = await response.json().catch(() => ({}));
    const code: string | undefined = payload?.detail?.code;
    // Re-raise backend codes the screen maps to localized messages.
    if (
      code === "AMOUNT_REQUIRED" ||
      code === "MEMBER_PAUSED" ||
      code === "CHECKOUT_REQUIRED" ||
      code === "BILLING_REQUIRED" ||
      code === "LOCATION_REQUIRED" ||
      code === "LOCATION_NOT_PERMITTED" ||
      code === "LOCATION_NOT_FOUND" ||
      code === "EARNING_CAP_REACHED" ||
      code === "CAP_OVERRIDE_NOT_ALLOWED"
    ) {
      const err = new Error(code);
      (err as any).code = code;
      // The cap payload carries which window is full, when it frees up, and
      // whether this user may override — the screen needs all three.
      (err as any).detail = payload?.detail;
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
    throw new Error("Failed to add points");
  }

  return response.json();
}
