import { describe, expect, it } from "bun:test";
import { buildPointsBody, buildRedeemBody, buildStampBody } from "./scanRequests";

describe("buildStampBody", () => {
  it("sends nothing at all for a plain single stamp with no key", () => {
    // Byte-identical on the wire to every build that shipped before idempotency
    // existed: no body, so a backend without migration 178 is unaffected.
    expect(buildStampBody({})).toBeUndefined();
  });

  it("carries the client key as client_key", () => {
    expect(buildStampBody({ clientKey: "abc" })).toEqual({ client_key: "abc" });
  });

  it("omits quantity at 1 and sends it above 1", () => {
    expect(buildStampBody({ quantity: 1 })).toBeUndefined();
    expect(buildStampBody({ quantity: 3 })).toEqual({ quantity: 3 });
  });

  it("omits cap_override unless it is true", () => {
    expect(buildStampBody({ capOverride: false })).toBeUndefined();
    expect(buildStampBody({ capOverride: true })).toEqual({ cap_override: true });
  });

  it("omits a null or absent location", () => {
    expect(buildStampBody({ locationId: null })).toBeUndefined();
    expect(buildStampBody({ locationId: "loc-1" })).toEqual({ location_id: "loc-1" });
  });

  it("carries everything the counter chose at once", () => {
    expect(
      buildStampBody({
        locationId: "loc-1",
        quantity: 4,
        capOverride: true,
        clientKey: "k-1",
      })
    ).toEqual({
      location_id: "loc-1",
      quantity: 4,
      cap_override: true,
      client_key: "k-1",
    });
  });
});

describe("buildRedeemBody", () => {
  it("sends nothing when the default redemption is meant and no key is held", () => {
    expect(buildRedeemBody({})).toBeUndefined();
  });

  it("names the held instance and the ladder reward separately", () => {
    expect(buildRedeemBody({ rewardId: "r-1" })).toEqual({ reward_id: "r-1" });
    expect(buildRedeemBody({ customerRewardId: "cr-1" })).toEqual({
      customer_reward_id: "cr-1",
    });
  });

  it("carries the client key", () => {
    expect(buildRedeemBody({ customerRewardId: "cr-1", clientKey: "k-2" })).toEqual({
      customer_reward_id: "cr-1",
      client_key: "k-2",
    });
  });
});

describe("buildPointsBody", () => {
  it("always sends the amount, even without a key", () => {
    // Unlike the stamp route, this one has nothing to say without an amount.
    expect(buildPointsBody({ amount: 12.5 })).toEqual({ amount: 12.5 });
  });

  it("carries the client key alongside the amount", () => {
    expect(buildPointsBody({ amount: 10, clientKey: "k-3" })).toEqual({
      amount: 10,
      client_key: "k-3",
    });
  });

  it("omits an absent location and a false override", () => {
    expect(buildPointsBody({ amount: 10, locationId: null, capOverride: false })).toEqual({
      amount: 10,
    });
  });
});
