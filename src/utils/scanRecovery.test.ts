import { describe, expect, it } from "bun:test";
import {
  SLOW_HINT_AFTER_MS,
  hintKeyForPhase,
  ownsRetry,
  recoveryErrorKey,
  reconciledResponse,
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

describe("recoveryErrorKey", () => {
  it("says nothing was recorded only when we actually looked and saw that", () => {
    expect(recoveryErrorKey("unchanged")).toBe("errors.timedOut");
  });

  it("never claims the scan failed when the re-read failed too", () => {
    // We do not know. Copy that asserts "nothing was recorded" here is a guess
    // the employee acts on, and the action is stamping the customer again.
    expect(recoveryErrorKey("unknown")).toBe("errors.offline");
  });
});

describe("reconcileVerdict — was the scan that timed out OURS?", () => {
  // The question is not "did anything change", it is "did MY request land".
  // Two tills serve one queue from the same customer record, so movement alone
  // proves nothing. Every ambiguous answer leans away from `credited`: an
  // extra tap replays the same key and costs nothing, while a wrong
  // `credited` silently swallows a scan or gives a reward away twice.

  const stampBefore: ReconcileTarget = {
    action: "stamp",
    stamps: 4,
    rewards: 0,
    expected: 2,
  };

  it("says unknown when the re-fetch itself failed", () => {
    expect(reconcileVerdict(stampBefore, null)).toBe("unknown");
  });

  it("credits a stamp scan that moved the card by exactly what it asked for", () => {
    expect(reconcileVerdict(stampBefore, customer({ stamps: 6 }))).toBe("credited");
  });

  it("reads an unmoved card as not credited", () => {
    expect(reconcileVerdict(stampBefore, customer({ stamps: 4 }))).toBe("unchanged");
  });

  it("does NOT claim another till's stamp as ours", () => {
    // We asked for 2. The card moved by 1, so someone else stamped it and ours
    // is still missing. Claiming this would leave the customer a stamp short
    // with a screen that said "already counted" and nobody any the wiser.
    expect(reconcileVerdict(stampBefore, customer({ stamps: 5 }))).toBe("unknown");
  });

  it("does not claim a rollover it cannot account for", () => {
    // A reward was banked and the counter reset. That may be our scan or the
    // other till's; the retry settles it for free.
    expect(reconcileVerdict(stampBefore, customer({ stamps: 1, rewards: 1 }))).toBe("unknown");
  });

  it("credits a points ticket only when the balance moved by the previewed amount", () => {
    const before: ReconcileTarget = { action: "points", balance: 120, expected: 30 };
    expect(reconcileVerdict(before, withProgram(150))).toBe("credited");
  });

  it("reads an unmoved points balance as not credited", () => {
    const before: ReconcileTarget = { action: "points", balance: 120, expected: 30 };
    expect(reconcileVerdict(before, withProgram(120))).toBe("unchanged");
  });

  it("does NOT claim a balance that moved by something else", () => {
    // Another till added a different ticket, or a redemption spent points.
    const before: ReconcileTarget = { action: "points", balance: 120, expected: 30 };
    expect(reconcileVerdict(before, withProgram(200))).toBe("unknown");
    expect(reconcileVerdict(before, withProgram(20))).toBe("unknown");
  });

  it("claims nothing when it never knew what the ticket was worth", () => {
    // The rate had not arrived, so there is no expectation to match against.
    const before: ReconcileTarget = { action: "points", balance: 120, expected: null };
    expect(reconcileVerdict(before, withProgram(150))).toBe("unknown");
  });

  describe("redeem", () => {
    // A stamp customer: the balance IS the stamp count, as the flows pass it.
    const named = (instanceId: string | null): ReconcileTarget => ({
      action: "redeem",
      instanceId,
      stamps: 3,
      rewards: 2,
      balance: 3,
    });

    it("reads the named reward instance disappearing as redeemed", () => {
      const after = withProgram(0, [instance("gift-2")]);
      after.stamps = 3;
      expect(reconcileVerdict(named("gift-1"), after)).toBe("credited");
    });

    it("reads the named instance still being held as not redeemed", () => {
      const after = withProgram(0, [instance("gift-1"), instance("gift-2")]);
      after.stamps = 3;
      expect(reconcileVerdict(named("gift-1"), after)).toBe("unchanged");
    });

    it("trusts the instance over a count another till moved underneath it", () => {
      // A reward was granted while ours was in flight, so the COUNT is
      // unchanged at two. Ours is gone, and that is what answers the question.
      const after = withProgram(0, [instance("gift-2"), instance("gift-3")]);
      after.stamps = 3;
      expect(reconcileVerdict(named("gift-1"), after)).toBe("credited");
    });

    it("does not call ours redeemed because a DIFFERENT reward was spent", () => {
      const after = withProgram(0, [instance("gift-1")]);
      after.stamps = 3;
      expect(reconcileVerdict(named("gift-1"), after)).toBe("unchanged");
    });

    it("NEVER credits an unnamed redemption, however favourable the movement", () => {
      // The classic full-card CTA and every points-menu redemption land here.
      // The other till redeeming resets the card and spends the balance in
      // exactly the same way ours would, so reading the drop as ours hands the
      // customer a SECOND reward for one full card, with the app saying to.
      const reset = customer({ stamps: 0, rewards: 2 });
      expect(reconcileVerdict(named(null), reset)).toBe("unknown");

      const spent = withProgram(300);
      spent.stamps = 300;
      expect(
        reconcileVerdict(
          { action: "redeem", instanceId: null, stamps: 500, rewards: 0, balance: 500 },
          spent
        )
      ).toBe("unknown");
    });

    it("still reports a genuinely untouched customer as unchanged", () => {
      const untouched = customer({ stamps: 3, rewards: 2 });
      expect(reconcileVerdict(named(null), untouched)).toBe("unchanged");
    });

    it("claims nothing from the scalar count when the backend names no instances", () => {
      // Without instances there is no attribution to be had, either way.
      expect(reconcileVerdict(named("gift-1"), customer({ stamps: 3, rewards: 1 }))).toBe(
        "unknown"
      );
      expect(reconcileVerdict(named("gift-1"), customer({ stamps: 3, rewards: 2 }))).toBe(
        "unchanged"
      );
    });
  });
});

describe("reconciledResponse", () => {
  it("carries the FRESH snapshot's values, not the ones we set out with", () => {
    const fresh = customer({ stamps: 7, rewards: 2, name: "Alex" });
    const response = reconciledResponse(fresh);

    expect(response.stamps).toBe(7);
    expect(response.rewards).toBe(2);
    expect(response.name).toBe("Alex");
    expect(response.customer_id).toBe(fresh.id);
  });

  it("reads a points balance off the program, not the legacy mirror", () => {
    const fresh = withProgram(340);
    fresh.stamps = 0;
    expect(reconciledResponse(fresh).value_after).toBe(340);
  });

  it("counts held instances rather than the scalar", () => {
    const fresh = withProgram(0, [instance("a"), instance("b")]);
    fresh.rewards = 0;
    expect(reconciledResponse(fresh).rewards).toBe(2);
  });

  it("claims no delta, because a reconcile never learns one", () => {
    // `delta` drives "3 stamps added" and the dot animation. We know where the
    // customer stands, not what this request contributed.
    expect(reconciledResponse(customer({ stamps: 3 })).delta).toBeUndefined();
  });

  it("carries no server message to render", () => {
    expect(reconciledResponse(customer()).message).toBe("");
  });
});

describe("ownsRetry — which control may offer to re-send", () => {
  it("lets the add button retry a failed add", () => {
    expect(ownsRetry({ kind: "stamp" }, { kind: "stamp" })).toBe(true);
    expect(ownsRetry({ kind: "points" }, { kind: "points" })).toBe(true);
  });

  it("NEVER turns an add button into Retry for a failed redemption", () => {
    // The bug this exists to prevent: an employee whose hand-over timed out
    // presses the Retry in front of them and STAMPS THE CARD instead.
    expect(ownsRetry({ kind: "redeem", instanceId: null }, { kind: "stamp" })).toBe(false);
    expect(ownsRetry({ kind: "redeem", instanceId: "gift-1" }, { kind: "points" })).toBe(false);
  });

  it("never turns a redeem button into Retry for a failed add", () => {
    expect(ownsRetry({ kind: "stamp" }, { kind: "redeem", instanceId: null })).toBe(false);
    expect(ownsRetry({ kind: "points" }, { kind: "redeem", instanceId: "gift-1" })).toBe(false);
  });

  it("keeps two redeem controls apart by the reward they would send", () => {
    // The generic CTA redeems the DEFAULT reward. Letting it advertise a named
    // reward's retry would send a different request under the same word.
    expect(
      ownsRetry({ kind: "redeem", instanceId: "gift-1" }, { kind: "redeem", instanceId: null })
    ).toBe(false);
    expect(
      ownsRetry({ kind: "redeem", instanceId: null }, { kind: "redeem", instanceId: "gift-1" })
    ).toBe(false);
    expect(
      ownsRetry({ kind: "redeem", instanceId: "gift-1" }, { kind: "redeem", instanceId: "gift-1" })
    ).toBe(true);
  });

  it("offers nothing when nothing is pending", () => {
    expect(ownsRetry(null, { kind: "stamp" })).toBe(false);
  });
});
