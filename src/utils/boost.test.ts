import { describe, expect, it } from "bun:test";
import { formatThreshold, previewBoost } from "./boost";
import type { BoostTier } from "../types/api";

const MULT: BoostTier = { threshold: 50, kind: "multiplier", value: 2 };
const FLAT: BoostTier = { threshold: 100, kind: "flat", value: 100 };

describe("previewBoost", () => {
  it("leaves an unboosted basket alone and names the tier still to come", () => {
    const p = previewBoost(30, 1, [MULT, FLAT]);
    expect(p).toMatchObject({ base: 30, bonus: 0, total: 30, tier: null });
    expect(p.nextTier?.threshold).toBe(50);
  });

  it("multiplies the whole basket, matching the backend", () => {
    // Backend parity: PointsEngine.add_progress, 60 EUR at 1 pt/EUR, x2 above 50.
    expect(previewBoost(60, 1, [MULT])).toMatchObject({ base: 60, bonus: 60, total: 120 });
  });

  it("adds a flat bonus without also multiplying", () => {
    expect(previewBoost(120, 1, [MULT, FLAT])).toMatchObject({ base: 120, bonus: 100, total: 220 });
  });

  it("applies the highest reached tier only", () => {
    expect(previewBoost(150, 1, [MULT, FLAT]).tier?.threshold).toBe(100);
    expect(previewBoost(99, 1, [MULT, FLAT]).tier?.threshold).toBe(50);
  });

  it("treats the threshold as inclusive", () => {
    expect(previewBoost(50, 1, [MULT]).tier).not.toBeNull();
    expect(previewBoost(49.99, 1, [MULT]).tier).toBeNull();
  });

  it("rounds half up like the backend, and the split reassembles", () => {
    expect(previewBoost(12.5, 1, []).total).toBe(13);
    expect(previewBoost(12.5, 0.5, [{ threshold: 10, kind: "multiplier", value: 1.5 }]))
      .toMatchObject({ base: 6, bonus: 3, total: 9 });
  });

  it("has no next tier once the top one is reached", () => {
    expect(previewBoost(500, 1, [MULT, FLAT]).nextTier).toBeNull();
  });

  it("previews nothing for an empty or invalid amount", () => {
    expect(previewBoost(0, 1, [MULT])).toMatchObject({ base: 0, bonus: 0, total: 0, tier: null });
    expect(previewBoost(NaN, 1, [MULT]).total).toBe(0);
  });

  it("falls back to a rate of 1 when the program has none", () => {
    expect(previewBoost(60, null, [MULT]).total).toBe(120);
  });

  it("degrades to an unboosted preview when no tiers are configured", () => {
    expect(previewBoost(60, 2, [])).toMatchObject({ base: 120, bonus: 0, total: 120 });
  });
});

describe("formatThreshold", () => {
  it("drops the decimals on the round amounts merchants actually set", () => {
    expect(formatThreshold(50)).toBe("50");
  });

  it("keeps the cents when there are any", () => {
    expect(formatThreshold(49.5)).toBe("49.50");
  });

  it("renders nothing for a broken value rather than 'NaN'", () => {
    expect(formatThreshold(NaN)).toBe("");
  });
});
