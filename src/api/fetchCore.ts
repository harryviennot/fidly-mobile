/**
 * The transport every API call goes through, with its dependencies injected.
 *
 * `client.ts` is the wiring — it hands this the real `fetch`, the real auth
 * headers and the real session refresh. The behaviour lives here because
 * `client.ts` imports `lib/supabase` and therefore react-native, whose
 * Flow-typed entrypoint Bun's test runner cannot parse (the same constraint
 * `src/locales/i18n-catalogs.test.ts` documents). Splitting it is what makes
 * the 401 dance and the request budget testable at all.
 *
 * Three outcomes leave this module, and the screens treat them differently:
 *
 * - a refused response  → ApiError carrying the backend's code and status
 * - our budget expired  → REQUEST_TIMEOUT, status 0 (it may still have landed)
 * - nothing was sent    → NETWORK_UNREACHABLE, status 0 (it certainly did not)
 */

import {
  toApiError,
  timeoutError,
  unreachableError,
} from "./errors";
import { TIMED_OUT, withTimeout } from "@/utils/withTimeout";

/** A refresh that has not answered by now is not going to. Shorter than the
 *  request budget: the employee is mid-scan with a customer waiting. */
export const REFRESH_TIMEOUT_MS = 8000;

/** Only what this module needs of `supabase.auth.refreshSession()`. */
export interface SessionRefreshResult {
  data: { session: { access_token: string } | null };
  error: { message?: string } | null;
}

export interface FetchCoreDeps {
  baseUrl: string;
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  authHeaders: () => Record<string, string>;
  refreshSession: () => Promise<SessionRefreshResult>;
  /** How long this ONE request may take before it is aborted. */
  timeoutMs: number;
  refreshTimeoutMs?: number;
}

/**
 * One attempt, bounded.
 *
 * The abort verdict is read off OUR flag, never off the rejection's name or
 * type: React Native has changed what an aborted fetch rejects with between
 * versions, and mistaking a timeout for an unreachable server would skip the
 * reconcile and let a landed scan be re-entered by hand.
 */
async function fetchOnce(
  url: string,
  init: RequestInit,
  deps: FetchCoreDeps
): Promise<Response> {
  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, deps.timeoutMs);

  let raced: Response | typeof TIMED_OUT;
  try {
    // RACED, not merely aborted. The abort is a courtesy to the socket; the
    // budget is enforced here, because a fetch that does not honour `signal`
    // (a polyfill, a webview, a native module holding the connection) would
    // otherwise hold the till open indefinitely with a spinner on it. Same
    // reasoning as utils/withTimeout, which exists for the same class of bug.
    raced = await withTimeout(
      deps.fetchImpl(url, { ...init, signal: controller.signal }),
      deps.timeoutMs
    );
  } catch {
    clearTimeout(timer);
    if (expired) throw timeoutError();
    throw unreachableError();
  }
  clearTimeout(timer);

  if (raced === TIMED_OUT) {
    controller.abort();
    throw timeoutError();
  }
  return raced;
}

/**
 * A path with its ids taken out, for logging.
 *
 * `/stamps/{business}/{enrollment}` names a business and one customer's
 * enrollment. Breadcrumbs travel to Sentry, so what goes in the log is the
 * route, not who it was about.
 */
export function redactPath(endpoint: string): string {
  return endpoint
    .split("/")
    .map((segment) =>
      /^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment) ? ":id" : segment
    )
    .join("/");
}

async function parseBody(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export async function requestWithAuthRetry<T>(
  endpoint: string,
  options: RequestInit,
  deps: FetchCoreDeps
): Promise<T> {
  const url = `${deps.baseUrl}${endpoint}`;
  const base = deps.authHeaders();
  const response = await fetchOnce(
    url,
    { ...options, headers: { ...base, ...options.headers } },
    deps
  );

  // On 401, refresh the session and retry once.
  if (response.status === 401) {
    console.log(`[API] 401 on ${redactPath(endpoint)}, attempting session refresh...`);
    // Bounded: this is the one await here with no abort behind it, and a stall
    // left the caller's promise pending forever — the screen's `finally` never
    // ran and the employee sat on a skeleton.
    const refreshed = await withTimeout(
      deps.refreshSession(),
      deps.refreshTimeoutMs ?? REFRESH_TIMEOUT_MS
    );
    if (refreshed === TIMED_OUT) {
      console.warn(`[API] session refresh timed out`);
      throw toApiError({}, 401, "Not authenticated");
    }
    const { data, error } = refreshed;
    if (error || !data.session) {
      console.warn(`[API] session refresh failed: ${error?.message || "no session"}`);
      throw toApiError(await parseBody(response), response.status, "Not authenticated");
    }
    console.log(`[API] session refreshed, retrying ${redactPath(endpoint)}`);

    // The SAME options: same method, same body, and therefore the same
    // client_key. A refresh in the middle of a scan must not turn one credit
    // into two — the backend dedupes the retry against the original.
    //
    // Every base header is kept and only Authorization is replaced. The
    // backend reads the scan's platform and the app version off
    // X-Client-Platform / X-App-Version, and a retry is still a scan from this
    // phone.
    const retry = await fetchOnce(
      url,
      {
        ...options,
        headers: {
          ...base,
          Authorization: `Bearer ${data.session.access_token}`,
          ...options.headers,
        },
      },
      deps
    );

    if (!retry.ok) {
      throw toApiError(await parseBody(retry), retry.status, `API error: ${retry.status}`);
    }
    return retry.json() as Promise<T>;
  }

  if (!response.ok) {
    throw toApiError(await parseBody(response), response.status, `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
