import { describe, expect, test } from "bun:test";
import { createWriteLock } from "./writeLock";

describe("a write in flight holds off every other write", () => {
  test("a held reward cannot be redeemed while a stamp is still sending", () => {
    const lock = createWriteLock();

    expect(lock.tryAcquire()).toBe(true); // the stamp goes out
    expect(lock.tryAcquire()).toBe(false); // a held-reward row is tapped
    expect(lock.tryAcquire()).toBe(false); // and the full-card redeem CTA
  });

  test("the next write goes through once the one in flight settles", () => {
    const lock = createWriteLock();
    lock.tryAcquire();

    lock.release();

    expect(lock.tryAcquire()).toBe(true);
  });

  test("each screen has its own lock", () => {
    // A points screen stuck mid-write must not freeze the next customer's.
    const first = createWriteLock();
    first.tryAcquire();

    expect(createWriteLock().tryAcquire()).toBe(true);
  });
});
