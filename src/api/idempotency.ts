/**
 * One tap, one credit.
 *
 * Every counter mutation carries a `client_key`. The backend claims that key
 * with the transaction row itself, so a second request bearing the same key
 * writes nothing and answers 200 with `replayed: true` and the customer's
 * current progress (STA-337). That is what makes a Retry safe: the employee can
 * press it without anyone having to know whether the first attempt landed.
 *
 * The rule that keeps it honest is one line long:
 *
 *   **a key is reused if and only if the request body is identical.**
 *
 * Reuse it too eagerly and a deliberate second scan is swallowed as a replay —
 * the customer is owed a stamp nobody can see is missing. Mint too eagerly and
 * the retry of an unconfirmed request credits twice, which is the bug this
 * whole stage exists to close. So the key is filed under a fingerprint of the
 * request, and a changed stepper quantity, a changed ticket price, a waived cap
 * (`cap_override` makes it a different request) or a different customer all
 * produce a different fingerprint, and therefore a different key.
 *
 * Pure: no React, no React Native, no crypto. The generator is injected, which
 * is what lets the tests assert "the same key came back" instead of "a key came
 * back". The real one is `mintClientKey` in `lib/client-key.ts`.
 */

/**
 * Separators, written as escapes rather than as the literal bytes.
 *
 * They cannot occur in a uuid, a number or a boolean, which is the point. The
 * escape spelling is also the point: an earlier revision of this file carried
 * the raw control characters, and they are invisible in every viewer that
 * reads this code, so the separator looked like it was never emitted at all.
 */
const UNIT = "\u001f";
const RECORD = "\u001e";

/** Keys minted during one confirmation screen's life, by request fingerprint. */
export type ClientKeyLedger = Record<string, string>;

/** The parts of a request that decide its identity. Absent parts are ignored. */
export type FingerprintParts = Record<string, string | number | boolean | null | undefined>;

/**
 * A stable string identity for one request.
 *
 * Key order does not matter (the caller writes what reads best at the call
 * site), absent values do not matter (an omitted field and an explicit
 * `undefined` produce the same request on the wire), and the type of a value
 * does matter: `1` and `"1"` are not the same body.
 */
export function scanFingerprint(parts: FingerprintParts): string {
  return Object.keys(parts)
    .filter((key) => parts[key] !== undefined)
    .sort()
    .map((key) => {
      const value = parts[key];
      // The type tag keeps 1 apart from "1"; the separators keep ("ab","c")
      // apart from ("a","bc"). Every value today is a uuid, a number or a
      // boolean and could not run together anyway, but the first free-text
      // field makes that collision real, and a collision is two different
      // scans sharing one key, the second swallowed as a replay.
      return [key, typeof value, String(value)].join(UNIT);
    })
    .join(RECORD);
}


/**
 * The key for this request: the one already minted for it, or a fresh one.
 *
 * Returns a new ledger rather than mutating the one it was handed, so the
 * caller's ref assignment is the single place the state moves.
 */
export function claimClientKey(
  ledger: ClientKeyLedger,
  fingerprint: string,
  mint: () => string
): { ledger: ClientKeyLedger; key: string } {
  const existing = ledger[fingerprint];
  if (existing) return { ledger, key: existing };

  const key = mint();
  return { ledger: { ...ledger, [fingerprint]: key }, key };
}

/**
 * Forget a key once its request is settled.
 *
 * Called on success: from then on, an identical tap is a SECOND deliberate
 * scan and has to be credited as one. A key is only replayable while nobody
 * knows whether its request landed.
 */
export function releaseClientKey(
  ledger: ClientKeyLedger,
  fingerprint: string
): ClientKeyLedger {
  if (!(fingerprint in ledger)) return ledger;
  const next = { ...ledger };
  delete next[fingerprint];
  return next;
}
