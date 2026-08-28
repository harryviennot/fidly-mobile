import type { BoostTier } from "../types/api";

export interface BoostPreview {
  /** Points the basket earns before any boost. */
  base: number;
  /** Points the boost adds on top. */
  bonus: number;
  total: number;
  /** The tier that applied, or null when the basket is below all of them. */
  tier: BoostTier | null;
  /** The cheapest tier still out of reach, for "boost from X" copy. */
  nextTier: BoostTier | null;
}

/**
 * What a basket earns, split base vs bonus, mirroring
 * `backend/app/services/programs/basket_boost.py`. The employee sees this
 * BEFORE submitting, so it has to agree with what the scan will credit:
 * round half UP like `previewPoints`, and for a multiplier round the TOTAL and
 * derive the bonus so base + bonus reassembles exactly.
 *
 * The tiers come from the per-customer snapshot, already clamped by the
 * backend to what the merchant's plan applies, so nothing is previewed that
 * the scan would not pay out.
 */
export function previewBoost(
  amount: number,
  rate: number | null | undefined,
  tiers: BoostTier[] | null | undefined
): BoostPreview {
  const r = typeof rate === "number" && rate > 0 ? rate : 1;
  const sorted = [...(tiers ?? [])].sort((a, b) => a.threshold - b.threshold);
  const nextTier = sorted.find((t) => !(amount >= t.threshold)) ?? null;

  if (!(amount > 0)) return { base: 0, bonus: 0, total: 0, tier: null, nextTier };

  const base = Math.floor(amount * r + 0.5);
  let tier: BoostTier | null = null;
  for (const candidate of sorted) {
    if (amount >= candidate.threshold) tier = candidate;
  }
  if (!tier) return { base, bonus: 0, total: base, tier: null, nextTier };

  const bonus =
    tier.kind === "multiplier" ? Math.floor(amount * r * tier.value + 0.5) - base : tier.value;
  return { base, bonus, total: base + bonus, tier, nextTier };
}

/**
 * A threshold as the counter should read it: "50", not "50.00". Merchants set
 * round amounts, but a decimal one still has to render its cents.
 */
export function formatThreshold(threshold: number): string {
  if (!Number.isFinite(threshold)) return "";
  return Number.isInteger(threshold) ? String(threshold) : threshold.toFixed(2);
}
