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
 */
export function formatExpiry(reward: BankedReward, now: Date = new Date()): ExpiryLabel | null {
  const expires = parse(reward.expires_at);
  if (!expires) return null;
  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) return { key: "expired", days: 0 };
  const days = Math.floor(diff / MS_PER_DAY);
  return days <= 0 ? { key: "today", days: 0 } : { key: "days", days };
}

/** True when the reward is still valid but close enough to warn about. */
export function expiresSoon(reward: BankedReward, now: Date = new Date()): boolean {
  const label = formatExpiry(reward, now);
  if (!label || label.key === "expired") return false;
  return label.days <= EXPIRY_WARNING_DAYS;
}
