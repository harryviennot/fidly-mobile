/**
 * Reward state of the stamp screen for the current card: redeem-or-skip vs
 * stamping, and whether held rewards are listed.
 */

import type { BankedReward } from "../types/api";

export interface StampScreenInput {
  totalStamps: number;
  currentStamps: number;
  stackable: boolean;
  maxStack: number | null;
  /** The reward instances the customer holds (`program.banked_rewards`). */
  heldRewards: BankedReward[];
  /** The scalar banked count, for backends that send no instance list. */
  rewardsCount: number;
}

export interface StampScreenState {
  rewards: number;
  /** The redeem-or-skip screen: a full reset card, or a stack at its cap. */
  isReadyForReward: boolean;
  /** The stamping screen lists held rewards (or the generic redeem button). */
  hasBankedRewards: boolean;
}

export function stampScreenState({
  totalStamps,
  currentStamps,
  stackable,
  maxStack,
  heldRewards,
  rewardsCount,
}: StampScreenInput): StampScreenState {
  const rewards = heldRewards.length || rewardsCount;
  const cardFull = currentStamps >= totalStamps;
  const atMaxStack = stackable && maxStack != null && rewards >= maxStack && cardFull;
  const isReadyForReward = cardFull && (!stackable || atMaxStack);
  // Stacking only decides whether a full card banks its reward and keeps
  // going. A held reward (banked, gifted from the dashboard, or a sign-up
  // welcome item) is redeemable on any card, so it is listed whenever the card
  // isn't waiting on its own reward.
  const hasBankedRewards = rewards > 0 && !isReadyForReward;
  return { rewards, isReadyForReward, hasBankedRewards };
}
