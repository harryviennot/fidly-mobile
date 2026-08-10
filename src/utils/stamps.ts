/**
 * Quantity limits for the multi-stamp stepper on the stamp screen.
 *
 * The employee sets how many stamps one scan is worth, so the ceiling has to be
 * whatever the card can actually absorb — offering "+" past that point promises
 * stamps the server will silently drop.
 */

/**
 * Hard ceiling per scan, mirroring the backend's `MAX_STAMP_QUANTITY`. Never
 * reached in practice (the card-based limit below is always smaller); it exists
 * so a nonsense card config can't produce a runaway stepper.
 */
export const MAX_STAMPS_PER_SCAN = 50;

interface StampQuantityInput {
  /** The card's goal (stamps needed for the reward). */
  totalStamps: number;
  /** Stamps already on the card. */
  currentStamps: number;
  /**
   * True for cards that keep climbing past the goal, banking a reward at each
   * checkpoint (`redemption_policy: 'stack'`). Those can absorb more than the
   * stamps left to the goal, because the counter rolls over.
   */
  stackable: boolean;
}

/**
 * The largest quantity the stepper should offer, always at least 1.
 *
 * Reset cards cap at the goal, so anything past "stamps remaining" is thrown
 * away server-side. Stacking cards roll over instead, so a full card's worth is
 * a sane, generous limit: one scan can complete the card and start the next.
 */
export function maxStampQuantity({
  totalStamps,
  currentStamps,
  stackable,
}: StampQuantityInput): number {
  // Defend against a missing or nonsense goal rather than rendering a broken stepper.
  const total = Number.isFinite(totalStamps) && totalStamps > 0 ? Math.floor(totalStamps) : 10;
  const current = Number.isFinite(currentStamps) && currentStamps > 0 ? Math.floor(currentStamps) : 0;

  const room = stackable ? total : total - current;
  return Math.min(Math.max(1, room), MAX_STAMPS_PER_SCAN);
}

/** Keep a quantity inside `1..max`, rounding away any fractional input. */
export function clampStampQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) return 1;
  const ceiling = Math.max(1, Math.min(Math.floor(max), MAX_STAMPS_PER_SCAN));
  return Math.min(Math.max(1, Math.floor(quantity)), ceiling);
}
