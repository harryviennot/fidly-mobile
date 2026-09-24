/**
 * The bodies the three counter mutations put on the wire.
 *
 * Split out of `customers.ts` / `points.ts` so the shape can be unit tested:
 * those modules reach react-native through `lib/supabase` and cannot be
 * imported under `bun test`.
 *
 * The omissions are deliberate and load-bearing. A plain single stamp with no
 * location and no key sends NO BODY AT ALL, byte-identical to what every build
 * before idempotency sent — so the scanner keeps working against a backend
 * where migration 178 has not been applied.
 */

export interface StampBodyInput {
  locationId?: string | null;
  /** Stamps this one scan is worth (the stepper). Omitted when 1. */
  quantity?: number;
  /** Owner/admin decision to push past a reached earning cap. Omitted unless true. */
  capOverride?: boolean;
  /** Idempotency key, omitted while none is held. */
  clientKey?: string | null;
}

export interface RedeemBodyInput {
  locationId?: string | null;
  rewardId?: string | null;
  customerRewardId?: string | null;
  clientKey?: string | null;
}

export interface PointsBodyInput {
  amount: number;
  locationId?: string | null;
  capOverride?: boolean;
  clientKey?: string | null;
}

type Body = Record<string, unknown>;

function orNothing(body: Body): Body | undefined {
  return Object.keys(body).length > 0 ? body : undefined;
}

export function buildStampBody(input: StampBodyInput): Body | undefined {
  const body: Body = {};
  if (input.locationId) body.location_id = input.locationId;
  if (input.quantity != null && input.quantity > 1) body.quantity = input.quantity;
  if (input.capOverride) body.cap_override = true;
  if (input.clientKey) body.client_key = input.clientKey;
  return orNothing(body);
}

export function buildRedeemBody(input: RedeemBodyInput): Body | undefined {
  const body: Body = {};
  if (input.locationId) body.location_id = input.locationId;
  if (input.rewardId) body.reward_id = input.rewardId;
  // Names ONE reward the customer already holds (STA-264) — the only way to
  // redeem a granted item, which sits on no ladder.
  if (input.customerRewardId) body.customer_reward_id = input.customerRewardId;
  if (input.clientKey) body.client_key = input.clientKey;
  return orNothing(body);
}

export function buildPointsBody(input: PointsBodyInput): Body {
  // Unlike the stamp route, this one is meaningless without an amount, so the
  // body is never empty.
  const body: Body = { amount: input.amount };
  if (input.locationId) body.location_id = input.locationId;
  if (input.capOverride) body.cap_override = true;
  if (input.clientKey) body.client_key = input.clientKey;
  return body;
}
