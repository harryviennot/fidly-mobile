import { describe, expect, it } from "bun:test";
import { MAX_STAMPS_PER_SCAN, clampStampQuantity, maxStampQuantity } from "./stamps";

describe("maxStampQuantity", () => {
  it("offers only the stamps a reset card still has room for", () => {
    expect(maxStampQuantity({ totalStamps: 10, currentStamps: 7, stackable: false })).toBe(3);
    expect(maxStampQuantity({ totalStamps: 10, currentStamps: 0, stackable: false })).toBe(10);
  });

  it("offers a full card's worth on a stacking card, which rolls over", () => {
    expect(maxStampQuantity({ totalStamps: 10, currentStamps: 7, stackable: true })).toBe(10);
  });

  it("never drops below 1, even on a card with no room left", () => {
    // The full-card screen takes over before this matters, but the stepper must
    // never render a 0 or a negative ceiling.
    expect(maxStampQuantity({ totalStamps: 10, currentStamps: 10, stackable: false })).toBe(1);
    expect(maxStampQuantity({ totalStamps: 10, currentStamps: 14, stackable: false })).toBe(1);
  });

  it("falls back to a sane goal when the card config is missing or broken", () => {
    expect(maxStampQuantity({ totalStamps: 0, currentStamps: 0, stackable: false })).toBe(10);
    expect(maxStampQuantity({ totalStamps: NaN, currentStamps: NaN, stackable: false })).toBe(10);
  });

  it("respects the server's per-scan ceiling on an unusually long card", () => {
    expect(maxStampQuantity({ totalStamps: 200, currentStamps: 0, stackable: true })).toBe(
      MAX_STAMPS_PER_SCAN
    );
  });
});

describe("clampStampQuantity", () => {
  it("keeps a quantity inside the allowed range", () => {
    expect(clampStampQuantity(3, 5)).toBe(3);
    expect(clampStampQuantity(9, 5)).toBe(5);
    expect(clampStampQuantity(0, 5)).toBe(1);
    expect(clampStampQuantity(-4, 5)).toBe(1);
  });

  it("rounds a fractional quantity down to a whole stamp", () => {
    expect(clampStampQuantity(2.7, 5)).toBe(2);
  });

  it("survives a broken max", () => {
    expect(clampStampQuantity(3, 0)).toBe(1);
    expect(clampStampQuantity(NaN, 5)).toBe(1);
  });
});
