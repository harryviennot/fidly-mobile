import { describe, expect, test } from "bun:test";

import {
  expiresSoon,
  formatExpiry,
  groupBankedRewards,
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

  test("a 3-day reward reads as 3 days from the moment it is granted", () => {
    // The off-by-one found in QA. The backend stores `granted_at + N days` to
    // the millisecond, so by the time anyone reads it the remaining span is
    // always a shade UNDER N — and flooring turned every "claimable for 3
    // days" into "expires in 2 days" for its whole life. The employee reads
    // this to a customer, so it has to match what the merchant configured.
    const granted = new Date(NOW.getTime() + 3 * 86400000 - 3000); // 3s after granting
    expect(formatExpiry(reward({ expires_at: granted.toISOString() }), NOW)).toEqual({
      key: "days",
      days: 3,
    });
  });

  test("counts down without skipping a rung", () => {
    const at = (days: number) =>
      formatExpiry(
        reward({ expires_at: new Date(NOW.getTime() + days * 86400000).toISOString() }),
        NOW
      );
    expect(at(2.9)).toEqual({ key: "days", days: 3 });
    expect(at(1.5)).toEqual({ key: "days", days: 2 });
    // The final 24 hours stay "today": "1 day" would tell an employee there is
    // slack until tomorrow when there may be six hours.
    expect(at(0.9)).toEqual({ key: "today", days: 0 });
    expect(at(0.1)).toEqual({ key: "today", days: 0 });
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

describe("groupBankedRewards", () => {
  test("merges rewards nothing distinguishes", () => {
    const groups = groupBankedRewards([
      reward({ id: "a" }),
      reward({ id: "b" }),
      reward({ id: "c" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    // The tap target is the first, which is drain order — the same instance
    // the server would spend if the employee redeemed without choosing.
    expect(groups[0].first.id).toBe("a");
  });

  test("a different deadline, name or origin stays its own row", () => {
    expect(
      groupBankedRewards([
        reward({ id: "a", expires_at: "2026-09-20T00:00:00Z" }),
        reward({ id: "b", expires_at: "2026-10-20T00:00:00Z" }),
      ])
    ).toHaveLength(2);
    expect(
      groupBankedRewards([reward({ id: "a" }), reward({ id: "b", name: "Free cake" })])
    ).toHaveLength(2);
    expect(
      groupBankedRewards([
        reward({ id: "a", source: "checkpoint" }),
        reward({ id: "b", source: "manual" }),
      ])
    ).toHaveLength(2);
  });

  test("keeps drain order and handles an empty hand", () => {
    expect(groupBankedRewards([])).toEqual([]);
    const groups = groupBankedRewards([
      reward({ id: "a", name: "Cake" }),
      reward({ id: "b", name: "Coffee" }),
      reward({ id: "c", name: "Cake" }),
    ]);
    expect(groups.map((g) => g.first.name)).toEqual(["Cake", "Coffee"]);
    expect(groups.map((g) => g.count)).toEqual([2, 1]);
  });
});
