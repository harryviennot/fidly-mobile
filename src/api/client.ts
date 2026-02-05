import { getAuthHeaders, supabase } from "../lib/supabase";

// Use environment variable with fallback
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.73:8000";

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
        throw new Error(body.detail || "Not authenticated");
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
          const error = await retryResponse.json().catch(() => ({}));
          throw new Error(error.detail || `API error: ${retryResponse.status}`);
        }

        return retryResponse.json();
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
