import { getAuthHeaders, supabase } from "../lib/supabase";
import { toApiError } from "./errors";
import { TIMED_OUT, withTimeout } from "@/utils/withTimeout";

// Use environment variable — validated at request time, not module load
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

if (API_BASE_URL) {
  console.log(`[API] API_BASE_URL: ${API_BASE_URL}`);
} else {
  console.warn("[API] EXPO_PUBLIC_API_URL is not defined — API calls will fail");
}

// Re-export for convenience
export { getAuthHeaders };

/** A refresh that has not answered by now is not going to. Shorter than the
 *  10s request budget: the employee is mid-scan with a customer waiting. */
const REFRESH_TIMEOUT_MS = 8000;

// Generic fetch helper with auth headers and 401 retry
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = getAuthHeaders();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // On 401, refresh the session and retry once
    if (response.status === 401) {
      clearTimeout(timeout);
      console.log(`[API] 401 on ${endpoint}, attempting session refresh...`);
      // Bounded: this is the ONE await in this file with no abort behind it,
      // and a stall here left the caller's promise pending forever — the
      // screen's `finally` never ran and the employee sat on a skeleton.
      const refreshed = await withTimeout(
        supabase.auth.refreshSession(),
        REFRESH_TIMEOUT_MS
      );
      if (refreshed === TIMED_OUT) {
        console.warn(`[API] session refresh timed out after ${REFRESH_TIMEOUT_MS}ms`);
        throw toApiError({}, 401, "Not authenticated");
      }
      const { data, error } = refreshed;
      if (error || !data.session) {
        console.warn(`[API] session refresh failed: ${error?.message || "no session"}`);
        const body = await response.json().catch(() => ({}));
        throw toApiError(body, response.status, "Not authenticated");
      }
      console.log(`[API] session refreshed, retrying ${endpoint}`);

      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 10000);
      try {
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          signal: retryController.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          const body = await retryResponse.json().catch(() => ({}));
          throw toApiError(body, retryResponse.status, `API error: ${retryResponse.status}`);
        }

        return retryResponse.json();
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw toApiError(body, response.status, `API error: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
