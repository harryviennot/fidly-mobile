import { apiFetch, getAuthHeaders, API_BASE_URL } from "./client";
import type {
  ScannableLocationsResponse,
  LocationMatch,
  LocationQRResponse,
} from "../types/api";

/**
 * Locations the current user can stamp at, plus a `requires_location` hint.
 * Role-aware server-side: owner/admin → all active locations (scope "all"),
 * scanner → only assigned locations (scope "assigned").
 */
export async function getScannableLocations(
  businessId: string
): Promise<ScannableLocationsResponse> {
  return apiFetch<ScannableLocationsResponse>(`/locations/${businessId}/scannable`);
}

/**
 * Closest active location to (lat, lng) for this business. Returns null when no
 * location has coordinates configured (backend responds 404 NO_GEOLOCATED_LOCATIONS).
 * Any other failure also resolves to null — GPS matching is strictly assistive
 * and must never block scanning.
 */
export async function matchLocation(
  businessId: string,
  lat: number,
  lng: number
): Promise<LocationMatch | null> {
  const headers = getAuthHeaders();
  try {
    const response = await fetch(
      `${API_BASE_URL}/locations/${businessId}/match?lat=${lat}&lng=${lng}`,
      { headers }
    );
    if (!response.ok) {
      // 404 = no geolocated locations; anything else = transient/unsupported.
      return null;
    }
    return (await response.json()) as LocationMatch;
  } catch {
    return null;
  }
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
