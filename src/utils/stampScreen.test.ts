import { describe, expect, it } from "bun:test";

import type { BankedReward } from "../types/api";
import { stampScreenState } from "./stampScreen";
import { bankedReward } from "./testFixtures";

const held = (source: BankedReward["source"], id = "cr-1") => bankedReward({ id, source });

const RESET = { totalStamps: 10, stackable: false, maxStack: null };
const STACKING = { totalStamps: 10, stackable: true, maxStack: 3 };

describe("stampScreenState", () => {
  // The three things a reset card can hold; it banks nothing of its own.
  it.each([
    ["a gift from the dashboard", held("manual")],
    ["a welcome item from sign-up", held("signup_bonus")],
    ["a reward banked before the program stopped stacking", held("checkpoint")],
  ])("lists %s on a reset card that isn't full", (_, reward) => {
    const state = stampScreenState({
      ...RESET, currentStamps: 3, heldRewards: [reward], rewardsCount: 0,
    });

    expect(state.hasBankedRewards).toBe(true);
    expect(state.isReadyForReward).toBe(false);
  });

  it("lists rewards banked on a stacking card", () => {
    const state = stampScreenState({
      ...STACKING, currentStamps: 3,
      heldRewards: [held("checkpoint", "a"), held("checkpoint", "b")], rewardsCount: 2,
    });

    expect(state.hasBankedRewards).toBe(true);
    expect(state.rewards).toBe(2);
  });

  it("shows no rewards zone when the customer holds nothing", () => {
    const state = stampScreenState({ ...RESET, currentStamps: 3, heldRewards: [], rewardsCount: 0 });

    expect(state.hasBankedRewards).toBe(false);
  });

  const BANKED_TO_CAP = ["a", "b", "c"].map((id) => held("checkpoint", id));

  it.each([
    ["a full reset card", { ...RESET, currentStamps: 10, rewardsCount: 0, banked: [] }],
    ["a stacking card full at its cap",
      { ...STACKING, currentStamps: 10, rewardsCount: 3, banked: BANKED_TO_CAP }],
  ])("keeps the redeem-or-skip screen for %s, even with a gift held", (_, { banked, ...card }) => {
    const state = stampScreenState({ ...card, heldRewards: [...banked, held("manual", "gift")] });

    expect(state.isReadyForReward).toBe(true);
    expect(state.hasBankedRewards).toBe(false);
  });

  it("falls back to the banked count when the backend sends no instance list", () => {
    const state = stampScreenState({ ...STACKING, currentStamps: 3, heldRewards: [], rewardsCount: 1 });

    expect(state.hasBankedRewards).toBe(true);
  });
});
