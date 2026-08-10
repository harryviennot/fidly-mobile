import { getAuthHeaders, supabase } from "../lib/supabase";
import { toApiError } from "./errors";

// Use environment variable — validated at request time, not module load
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

if (API_BASE_URL) {
  console.log(`[API] API_BASE_URL: ${API_BASE_URL}`);
} else {
  console.warn("[API] EXPO_PUBLIC_API_URL is not defined — API calls will fail");
}

// Re-export for convenience
export { getAuthHeaders };

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
      const { data, error } = await supabase.auth.refreshSession();
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
