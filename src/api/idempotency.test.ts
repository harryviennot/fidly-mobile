import { describe, expect, it } from "bun:test";
import {
  claimClientKey,
  releaseClientKey,
  scanFingerprint,
  type ClientKeyLedger,
} from "./idempotency";

/** Deterministic stand-in for expo-crypto's randomUUID. */
function counter() {
  let n = 0;
  const mint = () => `key-${++n}`;
  return { mint, minted: () => n };
}

describe("scanFingerprint", () => {
  it("is blind to the order the caller lists the parts in", () => {
    expect(scanFingerprint({ action: "stamp", quantity: 2, enrollmentId: "e1" })).toBe(
      scanFingerprint({ enrollmentId: "e1", action: "stamp", quantity: 2 })
    );
  });

  it("ignores absent parts, so an omitted field and an undefined one agree", () => {
    // buildStampBody drops quantity at 1, so "1" and "unset" are the same
    // request on the wire and must be the same key.
    expect(scanFingerprint({ action: "stamp", enrollmentId: "e1" })).toBe(
      scanFingerprint({ action: "stamp", enrollmentId: "e1", capOverride: undefined })
    );
  });

  it("separates the parts, so no two inputs can run together into one string", () => {
    // "ab" + "c" must not collide with "a" + "bc".
    expect(scanFingerprint({ action: "stamp", a: "ab", b: "c" })).not.toBe(
      scanFingerprint({ action: "stamp", a: "a", b: "bc" })
    );
  });

  it("keeps a value that imitates the encoding from colliding with two fields", () => {
    // Contrived on purpose: these two are byte-identical once the separators
    // are gone, because the second value spells out the key and type tag the
    // first pair would have emitted. Today every value is a uuid, a number or
    // a boolean and could never do this; the first free-text field could, and
    // a collision means two different scans sharing one key with the second
    // swallowed as a replay.
    expect(scanFingerprint({ a: "stringb", b: "c" })).not.toBe(
      scanFingerprint({ a: "stringbbstringc" })
    );
  });

  it("distinguishes the value 1 from the string '1'", () => {
    expect(scanFingerprint({ action: "stamp", quantity: 1 })).not.toBe(
      scanFingerprint({ action: "stamp", quantity: "1" })
    );
  });
});

describe("claimClientKey", () => {
  it("hands the SAME key back for a retry of the same request", () => {
    // The whole point: one tap, one credit, however many times the employee
    // presses Retry on a request that never answered.
    const { mint, minted } = counter();
    const fp = scanFingerprint({ action: "stamp", enrollmentId: "e1", quantity: 2 });

    const first = claimClientKey({}, fp, mint);
    const second = claimClientKey(first.ledger, fp, mint);

    expect(second.key).toBe(first.key);
    expect(minted()).toBe(1);
  });

  it("mints a NEW key when the stepper quantity changes", () => {
    const { mint } = counter();
    const two = claimClientKey({}, scanFingerprint({ action: "stamp", quantity: 2 }), mint);
    const three = claimClientKey(
      two.ledger,
      scanFingerprint({ action: "stamp", quantity: 3 }),
      mint
    );

    expect(three.key).not.toBe(two.key);
  });

  it("mints a NEW key when the points amount changes", () => {
    const { mint } = counter();
    const ten = claimClientKey({}, scanFingerprint({ action: "points", amount: 10 }), mint);
    const twelve = claimClientKey(
      ten.ledger,
      scanFingerprint({ action: "points", amount: 12 }),
      mint
    );

    expect(twelve.key).not.toBe(ten.key);
  });

  it("mints a NEW key for the cap-waive resubmit", () => {
    // The waived request carries cap_override: true — a DIFFERENT body. Reusing
    // the key would replay the request the server truncated, and the manager's
    // decision would silently do nothing.
    const { mint } = counter();
    const blocked = claimClientKey(
      {},
      scanFingerprint({ action: "stamp", quantity: 5 }),
      mint
    );
    const waived = claimClientKey(
      blocked.ledger,
      scanFingerprint({ action: "stamp", quantity: 5, capOverride: true }),
      mint
    );

    expect(waived.key).not.toBe(blocked.key);
  });

  it("mints a NEW key when the flow targets another customer", () => {
    const { mint } = counter();
    const a = claimClientKey({}, scanFingerprint({ action: "stamp", enrollmentId: "e1" }), mint);
    const b = claimClientKey(
      a.ledger,
      scanFingerprint({ action: "stamp", enrollmentId: "e2" }),
      mint
    );

    expect(b.key).not.toBe(a.key);
  });

  it("gives a stamp and a redeem of the same enrollment different keys", () => {
    // A key replayed across operation families is a 409 by design (the backend
    // refuses it) — and a stamp key spent on redeem would be free goods.
    const { mint } = counter();
    const stamp = claimClientKey({}, scanFingerprint({ action: "stamp", enrollmentId: "e1" }), mint);
    const redeem = claimClientKey(
      stamp.ledger,
      scanFingerprint({ action: "redeem", enrollmentId: "e1" }),
      mint
    );

    expect(redeem.key).not.toBe(stamp.key);
  });

  it("keeps each request's key, so going back to an earlier input resumes ITS key", () => {
    // Quantity 2 timed out unconfirmed; the employee tried 3, then went back to
    // 2. That is still the same unconfirmed request, so it must carry the same
    // key rather than risk a second credit.
    const { mint } = counter();
    const fpTwo = scanFingerprint({ action: "stamp", quantity: 2 });
    const first = claimClientKey({}, fpTwo, mint);
    const three = claimClientKey(
      first.ledger,
      scanFingerprint({ action: "stamp", quantity: 3 }),
      mint
    );
    const backToTwo = claimClientKey(three.ledger, fpTwo, mint);

    expect(backToTwo.key).toBe(first.key);
  });

  it("does not mutate the ledger it was handed", () => {
    const { mint } = counter();
    const ledger: ClientKeyLedger = {};
    claimClientKey(ledger, scanFingerprint({ action: "stamp" }), mint);

    expect(ledger).toEqual({});
  });
});

describe("releaseClientKey", () => {
  it("discards the key on success, so the next identical tap is a NEW request", () => {
    // Two deliberate scans of the same customer for the same quantity are two
    // credits. Only an unconfirmed request may be replayed.
    const { mint } = counter();
    const fp = scanFingerprint({ action: "stamp", quantity: 1 });
    const done = claimClientKey({}, fp, mint);

    const after = releaseClientKey(done.ledger, fp);
    const next = claimClientKey(after, fp, mint);

    expect(next.key).not.toBe(done.key);
  });

  it("leaves every other request's key alone", () => {
    const { mint } = counter();
    const fpAdd = scanFingerprint({ action: "stamp", quantity: 1 });
    const fpRedeem = scanFingerprint({ action: "redeem", enrollmentId: "e1" });
    const withAdd = claimClientKey({}, fpAdd, mint);
    const withBoth = claimClientKey(withAdd.ledger, fpRedeem, mint);

    const after = releaseClientKey(withBoth.ledger, fpAdd);

    expect(claimClientKey(after, fpRedeem, mint).key).toBe(withBoth.key);
  });

  it("does not mutate the ledger it was handed", () => {
    const { mint } = counter();
    const fp = scanFingerprint({ action: "stamp" });
    const { ledger } = claimClientKey({}, fp, mint);

    releaseClientKey(ledger, fp);

    expect(Object.keys(ledger)).toHaveLength(1);
  });
});
