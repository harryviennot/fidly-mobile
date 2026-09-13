/**
 * Reward instances the customer HOLDS (STA-264).
 *
 * Pure helpers only, no React and no React Native imports, so they can be unit
 * tested under `bun test` (RN-importing modules cannot be — see the note in
 * src/locales/i18n-catalogs.test.ts).
 */

import type { BankedReward } from "../types/api";

/** Within this many days, a reward is worth flagging at the counter. */
export const EXPIRY_WARNING_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ExpiryLabel = {
  /** Which string to render: an absolute day count, today, or already gone. */
  key: "days" | "today" | "expired";
  days: number;
};

function parse(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Drain order: soonest-expiring first, never-expiring last, ties by name.
 *
 * Mirrors the backend's `sort_active`, so the reward the employee sees at the
 * top of the list is the same one the server would pick if they redeem without
 * choosing. Returns a new array.
 */
export function sortBankedRewards(rewards: BankedReward[]): BankedReward[] {
  return [...rewards].sort((a, b) => {
    const ea = parse(a.expires_at);
    const eb = parse(b.expires_at);
    if (ea && eb) return ea.getTime() - eb.getTime() || a.name.localeCompare(b.name);
    if (ea) return -1;
    if (eb) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * How to describe a reward's expiry, or null when it never expires.
 *
 * The last day is "today", not "0 days": at the counter an employee needs to
 * know a reward is still redeemable right now, and "expires in 0 days" reads
 * as already gone.
 *
 * Rounded UP, not down. The backend stores `granted_at + N days` to the
 * millisecond, so the remaining span is always a shade under a whole number of
 * days — and flooring turned every "claimable for 3 days" into "expires in 2
 * days" for the reward's entire life. The employee reads this number out to
 * the customer; it has to be the number the merchant configured.
 */
export function formatExpiry(reward: BankedReward, now: Date = new Date()): ExpiryLabel | null {
  const expires = parse(reward.expires_at);
  if (!expires) return null;
  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) return { key: "expired", days: 0 };
  const days = Math.ceil(diff / MS_PER_DAY);
  return days <= 1 ? { key: "today", days: 0 } : { key: "days", days };
}

/** True when the reward is still valid but close enough to warn about. */
export function expiresSoon(reward: BankedReward, now: Date = new Date()): boolean {
  const label = formatExpiry(reward, now);
  if (!label || label.key === "expired") return false;
  return label.days <= EXPIRY_WARNING_DAYS;
}

export interface BankedRewardGroup {
  key: string;
  /** The instance a tap on this row redeems: the next one the server drains. */
  first: BankedReward;
  count: number;
}

/**
 * Collapse runs of the identical reward into one row.
 *
 * The dashboard already does this; the scanner did not, so a customer holding
 * six of the same thing pushed the stamp buttons off a phone screen to say one
 * fact six times. Rows merge only when nothing distinguishes them — same name,
 * same origin, same deadline — so a group never hides a difference that would
 * change what the employee hands over.
 *
 * Input order is preserved (it is already drain order), so `first` is the
 * instance that will be spent.
 */
export function groupBankedRewards(rewards: BankedReward[]): BankedRewardGroup[] {
  const groups: BankedRewardGroup[] = [];
  const byKey = new Map<string, BankedRewardGroup>();
  for (const reward of rewards) {
    const key = [reward.name, reward.source, reward.expires_at ?? ""].join("\u0000");
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const group: BankedRewardGroup = { key, first: reward, count: 1 };
    byKey.set(key, group);
    groups.push(group);
  }
  return groups;
}
