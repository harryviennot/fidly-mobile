/**
 * Bound a promise that has no timeout of its own.
 *
 * The scanner's `apiFetch` aborts every network call after 10s — except the
 * `supabase.auth.refreshSession()` it makes when a request comes back 401.
 * That one await had nothing behind it, so a stalled refresh left the caller's
 * promise pending forever: the screen's `finally` never ran, `loading` stayed
 * true, and the employee watched a skeleton until they killed the app. An
 * expired session is exactly when that call is least likely to come back.
 *
 * Resolves to `TIMED_OUT` rather than rejecting, so the caller decides what a
 * stall means — here it means "treat the session as dead and say so".
 */
export const TIMED_OUT = Symbol('TIMED_OUT');

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
