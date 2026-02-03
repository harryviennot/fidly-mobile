import { getAuthHeaders } from "../lib/supabase";

// Use environment variable with fallback
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://10.15.192.211:8000";

// Re-export for convenience
export { getAuthHeaders };

// Generic fetch helper with auth headers
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
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
}
