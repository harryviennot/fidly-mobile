/**
 * Where a scan's idempotency key comes from.
 *
 * Unguessable, not merely unique. A transaction's `client_key` is visible over
 * realtime to every member of the business, so a key anyone could predict could
 * be claimed first by another device: the real scan would come back as a replay
 * that credited nothing, and the customer would leave a stamp short with a
 * screen that said "already counted" (stage-5 security review of STA-337).
 *
 * `expo-crypto`'s randomUUID is backed by the platform CSPRNG. The ordinary
 * pseudo-random generator is not, and must never appear on this path — a test
 * in `api/transport-invariants.test.ts` scans this file to keep it out.
 *
 * Its own module so the pure key bookkeeping in `api/idempotency.ts` stays free
 * of native imports and therefore unit testable.
 */

import * as Crypto from "expo-crypto";

export function mintClientKey(): string {
  return Crypto.randomUUID();
}
