import { describe, expect, test } from "bun:test";

import {
  expiresSoon,
  formatExpiry,
  sortBankedRewards,
} from "./rewardInstances";
import type { BankedReward } from "../types/api";

const NOW = new Date("2026-09-10T12:00:00Z");

function reward(over: Partial<BankedReward> = {}): BankedReward {
  return {
    id: "cr-1",
    reward_id: "r_base",
    name: "Free coffee",
    source: "checkpoint",
    expires_at: null,
    ...over,
  };
}

describe("sortBankedRewards", () => {
  test("puts the soonest-expiring reward first and never-expiring last", () => {
    // Drain order is customer-favourable: spend what would die first, so a
    // customer holding one expiring and one permanent reward keeps both for
    // as long as possible.
    const sorted = sortBankedRewards([
      reward({ id: "never", expires_at: null }),
      reward({ id: "later", expires_at: "2026-10-01T00:00:00Z" }),
      reward({ id: "soon", expires_at: "2026-09-12T00:00:00Z" }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["soon", "later", "never"]);
  });

  test("does not mutate the input array", () => {
    const input = [
      reward({ id: "a", expires_at: null }),
      reward({ id: "b", expires_at: "2026-09-12T00:00:00Z" }),
    ];
    sortBankedRewards(input);
    expect(input.map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("handles an empty list", () => {
    expect(sortBankedRewards([])).toEqual([]);
  });
});

describe("formatExpiry", () => {
  test("returns null when the reward never expires", () => {
    expect(formatExpiry(reward({ expires_at: null }), NOW)).toBeNull();
  });

  test("counts whole days remaining", () => {
    expect(formatExpiry(reward({ expires_at: "2026-09-13T12:00:00Z" }), NOW)).toEqual({
      key: "days",
      days: 3,
    });
  });

  test("calls the last day today rather than 0 days", () => {
    // "expires in 0 days" reads as already gone; at the counter the employee
    // needs to know it is still redeemable right now.
    expect(formatExpiry(reward({ expires_at: "2026-09-10T23:00:00Z" }), NOW)).toEqual({
      key: "today",
      days: 0,
    });
  });

  test("marks an already-lapsed reward expired", () => {
    expect(formatExpiry(reward({ expires_at: "2026-09-09T00:00:00Z" }), NOW)).toEqual({
      key: "expired",
      days: 0,
    });
  });

  test("ignores an unparseable date instead of showing NaN", () => {
    expect(formatExpiry(reward({ expires_at: "not-a-date" }), NOW)).toBeNull();
  });
});

describe("expiresSoon", () => {
  test("flags rewards inside the warning window", () => {
    expect(expiresSoon(reward({ expires_at: "2026-09-12T00:00:00Z" }), NOW)).toBe(true);
    expect(expiresSoon(reward({ expires_at: "2026-09-30T00:00:00Z" }), NOW)).toBe(false);
    expect(expiresSoon(reward({ expires_at: null }), NOW)).toBe(false);
  });

  test("does not flag one that has already lapsed", () => {
    // Already-expired rewards are filtered out server-side; if one slips
    // through, "expires soon" would be a lie.
    expect(expiresSoon(reward({ expires_at: "2026-09-01T00:00:00Z" }), NOW)).toBe(false);
  });
});
