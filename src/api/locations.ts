import { apiFetch } from "./client";
import type {
  ScannableLocationsResponse,
  LocationQRResponse,
} from "../types/api";

/**
 * Locations the current user can stamp at, plus a `requires_location` hint.
 * Role-aware server-side: owner/admin → all active locations (scope "all"),
 * scanner → only assigned locations (scope "assigned").
 *
 * Note: proximity matching is done entirely on-device (see `utils/geo.ts`) —
 * the device's coordinates are never sent to the backend.
 */
export async function getScannableLocations(
  businessId: string
): Promise<ScannableLocationsResponse> {
  return apiFetch<ScannableLocationsResponse>(`/locations/${businessId}/scannable`);
}

/**
 * Location-specific customer enrollment QR (Pro multi-location). The scanner
 * lobby shows this instead of the business-wide signup QR so new customers who
 * enroll here get attributed to this location.
 */
export async function getLocationQR(
  businessId: string,
  locationId: string
): Promise<LocationQRResponse> {
  return apiFetch<LocationQRResponse>(`/locations/${businessId}/${locationId}/qr`);
}
