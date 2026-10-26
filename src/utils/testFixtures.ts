import type { BankedReward } from "../types/api";

/** A held reward for tests: a card-earned free coffee unless overridden. */
export function bankedReward(over: Partial<BankedReward> = {}): BankedReward {
  return {
    id: "cr-1",
    reward_id: null,
    name: "Free coffee",
    source: "checkpoint",
    expires_at: null,
    ...over,
  };
}
