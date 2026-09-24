/**
 * Where a scan's idempotency key comes from.
 *
 * Unguessable, not merely unique. A transaction's `client_key` is visible over
 * realtime to every member of the business, so a key anyone could predict could
 * be claimed first by another device: the real scan would come back as a replay
 * that credited nothing, and the customer would leave a stamp short with a
 * screen that said "already counted" (stage-5 security review of STA-337).
 *
 * `randomUUID` is the first choice and is NOT always there. On the web build it
 * is gated behind a secure context and missing entirely on older Safari and
 * Chrome, where reaching for it throws a TypeError. That throw used to escape
 * the press handler before any state was set, so the button did nothing at all
 * (no spinner, no banner) and the till quietly stopped taking scans. Hence the
 * fallback, and hence the call sites keeping this inside their try.
 *
 * Both paths are the platform CSPRNG. The ordinary pseudo-random generator is
 * not one and must never appear here: a test in
 * `api/transport-invariants.test.ts` scans this file to keep it out.
 *
 * Its own module so the pure key bookkeeping in `api/idempotency.ts` stays free
 * of native imports and therefore unit testable.
 */

import * as Crypto from "expo-crypto";

/** RFC 4122 v4, laid out by hand from 16 CSPRNG bytes. */
function uuidFromRandomBytes(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function mintClientKey(): string {
  const api = Crypto as { randomUUID?: () => string };
  if (typeof api.randomUUID === "function") {
    try {
      return api.randomUUID();
    } catch {
      // Present but refused (secure-context gating). Fall through.
    }
  }
  return uuidFromRandomBytes();
}
