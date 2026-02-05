import { getAuthHeaders } from "../lib/supabase";

// Use environment variable with fallback
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.122:8000";

// Re-export for convenience
export { getAuthHeaders };

// Generic fetch helper with auth headers
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();

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

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
