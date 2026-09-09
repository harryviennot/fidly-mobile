/**
 * Classifies a raw Supabase / Google / Apple auth failure into an i18n key.
 *
 * Pure module with no React Native imports so it stays unit-testable, in the
 * same spirit as `src/api/errors.ts`.
 *
 * Why this exists (STA-246): every sign-in failure used to reach the employee
 * as the same "Sign-in failed. Please try again." -- a user cancelling, a
 * Supabase audience rejection, and an Android DEVELOPER_ERROR were
 * indistinguishable, so a total provider outage looked like a flaky tap. The
 * two provider-misconfiguration cases in particular must NOT say "try again":
 * retrying can never work, and the employee needs to be pointed at another
 * method.
 */

export type AuthErrorKey =
  | "invalidCredentials"
  | "tooManyRequests"
  | "userNotFound"
  | "networkError"
  | "providerUnavailable"
  | "generic";

/** Google Play Services rejects a package/SHA-1 with no registered OAuth client. */
const DEVELOPER_ERROR_CODE = "10";

export function classifyAuthError(
  message: string | undefined | null,
  code?: string | number | null
): AuthErrorKey {
  if (String(code ?? "") === DEVELOPER_ERROR_CODE) return "providerUnavailable";

  const msg = (message ?? "").toLowerCase();
  if (!msg) return "generic";

  // Provider misconfiguration -- checked first, because some of these also
  // contain words like "invalid" that would otherwise match a broader rule.
  if (
    msg.includes("audience") ||
    msg.includes("developer_error") ||
    msg.includes("clientid") ||
    msg.includes("client id") ||
    msg.includes("provider is not enabled") ||
    msg.includes("unsupported provider") ||
    // The native module is missing from this binary (Expo Go, or a build made
    // before the dependency existed).
    msg.includes("unavailable in this build")
  ) {
    return "providerUnavailable";
  }

  if (
    msg.includes("invalid") &&
    (msg.includes("credentials") || msg.includes("password") || msg.includes("login"))
  ) {
    return "invalidCredentials";
  }

  if (msg.includes("rate") || msg.includes("too many") || msg.includes("429")) {
    return "tooManyRequests";
  }

  if (msg.includes("user not found") || msg.includes("no user")) {
    return "userNotFound";
  }

  if (msg.includes("network") || msg.includes("fetch")) {
    return "networkError";
  }

  return "generic";
}
