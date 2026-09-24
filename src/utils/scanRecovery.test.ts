import { describe, expect, it } from "bun:test";
import {
  SLOW_HINT_AFTER_MS,
  hintKeyForPhase,
  rewardCount,
  reconcileVerdict,
  type ReconcileTarget,
} from "./scanRecovery";
import type { BankedReward, Customer } from "../types/api";

function instance(id: string): BankedReward {
  return { id, reward_id: null, name: "Free coffee", source: "checkpoint", expires_at: null };
}

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    business_id: "b1",
    name: "Alex",
    email: "a@b.c",
    stamps: 0,
    ...over,
  } as Customer;
}

function withProgram(primary: number, banked?: BankedReward[]): Customer {
  return customer({
    stamps: primary,
    program: {
      type: "points",
      primary_value: primary,
      display: `${primary} pts`,
      reward_ready: false,
      is_complete: false,
      next_threshold: null,
      threshold_after: null,
      max_limit: null,
      lifetime: null,
      rewards_banked: banked?.length ?? 0,
      rewards: [],
      points_per_currency_unit: 1,
      earning_cap: null,
      ...(banked ? { banked_rewards: banked } : {}),
    },
  } as Partial<Customer>);
}

describe("the in-flight hint", () => {
  it("says nothing until the request is genuinely slow", () => {
    // A hint on every tap would train the employee to ignore it.
    expect(hintKeyForPhase("idle")).toBeNull();
    expect(hintKeyForPhase("submitting")).toBeNull();
  });

  it("admits the network is slow, then that it is checking", () => {
    expect(hintKeyForPhase("slow")).toBe("errors.slowNetwork");
    expect(hintKeyForPhase("confirming")).toBe("errors.confirming");
  });

  it("waits about three seconds, long enough that a normal scan never sees it", () => {
    expect(SLOW_HINT_AFTER_MS).toBe(3000);
  });
});

describe("rewardCount", () => {
  it("counts the named instances the customer holds", () => {
    expect(rewardCount(withProgram(0, [instance("a"), instance("b")]))).toBe(2);
  });

  it("falls back to the scalar for a backend that sends no instances", () => {
    expect(rewardCount(customer({ rewards: 3 }))).toBe(3);
  });

  it("is zero when the customer holds nothing either way", () => {
    expect(rewardCount(customer())).toBe(0);
  });
});

describe("reconcileVerdict — did the scan that timed out actually land?", () => {
  const stampBefore: ReconcileTarget = { action: "stamp", stamps: 4, rewards: 0 };

  it("says unknown when the re-fetch itself failed", () => {
    // We know nothing, so the screen must say nothing about whether it landed.
    expect(reconcileVerdict(stampBefore, null)).toBe("unknown");
  });

  it("reads a higher stamp count as credited", () => {
    expect(reconcileVerdict(stampBefore, customer({ stamps: 6 }))).toBe("credited");
  });

  it("reads an unmoved card as not credited", () => {
    expect(reconcileVerdict(stampBefore, customer({ stamps: 4 }))).toBe("unchanged");
  });

  it("catches the rollover, where the card RESET and a reward was banked", () => {
    // 4 stamps + 3 on a 6-stamp card: the count ends at 1, BELOW where it
    // started. Comparing stamps alone would tell the employee to stamp again.
    const after = customer({ stamps: 1, rewards: 1 });

    expect(reconcileVerdict(stampBefore, after)).toBe("credited");
  });

  it("prefers the reward instances over the scalar count", () => {
    // STA-264: `banked_rewards` is the truth; `rewards` is the legacy mirror
    // and can lag it.
    const after = withProgram(4, [instance("new")]);
    after.stamps = 4;
    after.rewards = 0;

    expect(reconcileVerdict(stampBefore, after)).toBe("credited");
  });

  it("reads a points balance that rose as credited", () => {
    expect(reconcileVerdict({ action: "points", balance: 120 }, withProgram(150))).toBe(
      "credited"
    );
  });

  it("reads an unmoved points balance as not credited", () => {
    expect(reconcileVerdict({ action: "points", balance: 120 }, withProgram(120))).toBe(
      "unchanged"
    );
  });

  it("does not call a FALLEN balance credited, even though something moved", () => {
    // Another till redeemed for this customer while our add was in flight. We
    // cannot tell our points from theirs, so we take the answer that is always
    // safe: offer Retry. The client key makes a re-send free — the backend
    // replays the original instead of crediting twice.
    expect(reconcileVerdict({ action: "points", balance: 120 }, withProgram(20))).toBe(
      "unchanged"
    );
  });

  it("reads the named reward instance disappearing as redeemed", () => {
    const before: ReconcileTarget = {
      action: "redeem",
      instanceId: "gift-1",
      stamps: 3,
      rewards: 2,
      balance: 0,
    };
    const after = withProgram(0, [instance("gift-2")]);
    after.stamps = 3;

    expect(reconcileVerdict(before, after)).toBe("credited");
  });

  it("reads the named instance still being held as not redeemed", () => {
    const before: ReconcileTarget = {
      action: "redeem",
      instanceId: "gift-1",
      stamps: 3,
      rewards: 2,
      balance: 0,
    };
    const after = withProgram(0, [instance("gift-1"), instance("gift-2")]);
    after.stamps = 3;

    expect(reconcileVerdict(before, after)).toBe("unchanged");
  });

  it("falls back to the counts when the backend names no instances", () => {
    const before: ReconcileTarget = {
      action: "redeem",
      instanceId: "gift-1",
      stamps: 3,
      rewards: 2,
      balance: 0,
    };

    expect(reconcileVerdict(before, customer({ stamps: 3, rewards: 1 }))).toBe("credited");
    expect(reconcileVerdict(before, customer({ stamps: 3, rewards: 2 }))).toBe("unchanged");
  });

  it("reads the classic full card resetting as redeemed", () => {
    // No instance named, no balance: a full card that went back to zero is the
    // redemption.
    const before: ReconcileTarget = {
      action: "redeem",
      instanceId: null,
      stamps: 10,
      rewards: 0,
      balance: 0,
    };

    expect(reconcileVerdict(before, customer({ stamps: 0 }))).toBe("credited");
  });

  it("reads a spent points balance as redeemed off the menu", () => {
    const before: ReconcileTarget = {
      action: "redeem",
      instanceId: null,
      stamps: 500,
      rewards: 0,
      balance: 500,
    };

    expect(reconcileVerdict(before, withProgram(300))).toBe("credited");
  });
});
