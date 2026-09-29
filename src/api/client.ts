import { getAuthHeaders, supabase } from "../lib/supabase";
import { requestWithAuthRetry, type FetchCoreDeps } from "./fetchCore";

// Use environment variable — validated at request time, not module load
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

if (API_BASE_URL) {
  console.log(`[API] API_BASE_URL: ${API_BASE_URL}`);
} else {
  console.warn("[API] EXPO_PUBLIC_API_URL is not defined — API calls will fail");
}

// Re-export for convenience
export { getAuthHeaders };

/** What a read may take. Generous: nobody is waiting on it at a till. */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * What a counter mutation may take.
 *
 * Shorter than a read on purpose: a customer is standing there, and an answer
 * that arrives after this is no longer an answer, it is a frozen screen the
 * employee taps again. Past this point the scanner stops waiting and goes and
 * finds out what happened (see utils/scanRecovery).
 */
export const MUTATION_TIMEOUT_MS = 8000;

export interface ApiFetchConfig {
  /** Override the request budget. Defaults to REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Generic fetch helper with auth headers, a request budget and a bounded
 * 401 refresh-and-retry-once.
 *
 * The behaviour lives in `fetchCore`, which takes its dependencies as
 * arguments; this is the wiring that hands it the real ones. That split is
 * what makes the 401 dance testable — this module imports `lib/supabase`, and
 * through it react-native, which Bun's test runner cannot load.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  config: ApiFetchConfig = {}
): Promise<T> {
  const deps: FetchCoreDeps = {
    baseUrl: API_BASE_URL,
    fetchImpl: (url, init) => fetch(url, init),
    authHeaders: () => getAuthHeaders() as Record<string, string>,
    refreshSession: () => supabase.auth.refreshSession(),
    timeoutMs: config.timeoutMs ?? REQUEST_TIMEOUT_MS,
  };

  return requestWithAuthRetry<T>(endpoint, options, deps);
}
