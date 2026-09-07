/**
 * Join-code helpers, the TypeScript twin of backend/app/core/join_codes.py.
 *
 * Pure module with no React Native imports so it stays unit-testable.
 *
 * The alphabet excludes both halves of every confusable pair (0/O, 1/I/L) plus
 * U. That means there is nothing to fold on input: a typed "O" is a typo, not a
 * misread of a real code, so `normalizeJoinCode` keeps it and
 * `isValidJoinCode` rejects it. The employee gets "check the code" instead of a
 * silent lookup miss.
 *
 * If you change a rule here, change it in the backend module and in
 * web/src/lib/join-code.ts too.
 */

export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

/** Separators a human, or iOS autocorrect, might type between groups. */
const SEPARATORS = new Set([
  " ", "\t", "\r", "\n", "-", "_", ".",
  "‐", "‑", "‒", "–", "—", "―",
]);

/** Uppercase and strip separators, so "abc-d3f" and " ABC D3F " both work. */
export function normalizeJoinCode(raw: string | null | undefined): string {
  if (!raw) return "";
  return Array.from(raw.toUpperCase())
    .filter((c) => !SEPARATORS.has(c))
    .join("");
}

/** Shape check only. Says nothing about whether the code exists. */
export function isValidJoinCode(code: string | null | undefined): boolean {
  if (!code || code.length !== JOIN_CODE_LENGTH) return false;
  return Array.from(code).every((c) => JOIN_CODE_ALPHABET.includes(c));
}

/** Display form: "ABCD3F" -> "ABC-D3F". Never sent to the backend. */
export function formatJoinCode(code: string | null | undefined): string {
  const normalized = normalizeJoinCode(code);
  if (normalized.length !== JOIN_CODE_LENGTH) return normalized;
  const half = JOIN_CODE_LENGTH / 2;
  return `${normalized.slice(0, half)}-${normalized.slice(half)}`;
}

/**
 * What the code-entry field accepts per keystroke: normalises, then drops
 * anything outside the alphabet so an impossible character can never be typed
 * in the first place, and caps at the code length.
 */
export function sanitizeJoinCodeInput(raw: string): string {
  return Array.from(normalizeJoinCode(raw))
    .filter((c) => JOIN_CODE_ALPHABET.includes(c))
    .slice(0, JOIN_CODE_LENGTH)
    .join("");
}

/** Backend error codes the join flow branches on. */
export const JOIN_ERROR_KEYS = [
  "JOIN_CODE_INVALID",
  "JOIN_CODE_EXPIRED",
  "JOIN_CODE_USED",
  "JOIN_CODE_REVOKED",
  "ALREADY_MEMBER",
  "LIMIT_EXCEEDED",
  "BILLING_REQUIRED",
  "CHECKOUT_REQUIRED",
  "BUSINESS_NOT_ACTIVE",
] as const;

export type JoinErrorCode = (typeof JOIN_ERROR_KEYS)[number];

/** Map a backend error code to its i18n key under the `join` namespace. */
export function joinErrorKey(code: string | undefined): string {
  const known = (JOIN_ERROR_KEYS as readonly string[]).includes(code ?? "");
  return `errors.${known ? code : "GENERIC"}`;
}

/**
 * How long a code held across the sign-in detour stays usable.
 *
 * Short on purpose: a stale code sitting in storage would silently pull someone
 * into a shop they tried to join days ago.
 */
export const PENDING_CODE_TTL_MS = 15 * 60 * 1000;

/** Is a stored pending code still within its window? */
export function isPendingCodeFresh(
  savedAt: number,
  now: number,
  ttlMs: number = PENDING_CODE_TTL_MS
): boolean {
  if (!Number.isFinite(savedAt) || savedAt <= 0) return false;
  const age = now - savedAt;
  // A negative age means the clock moved backwards (timezone change, manual
  // set). Treat it as untrustworthy rather than as infinitely fresh.
  return age >= 0 && age < ttlMs;
}
