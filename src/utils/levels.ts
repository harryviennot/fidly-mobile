/**
 * Loyalty levels on the scan screens: who just moved up, what their perks are,
 * and how big their card is. Pure, so the flows only mount the pieces.
 *
 * Every input is optional and null-safe: an older backend sends none of the
 * level fields and each helper then answers "nothing to show".
 */

import type { Customer, LevelBrief, ProgramLevel, StampResponse } from "../types/api";

/** i18next's `t`, narrowed to what these helpers need. */
export type Translate = (key: string, vars?: Record<string, string>) => string;

/** Cards with no size of their own fall back to this many stamps. */
const DEFAULT_CARD_SIZE = 10;

/** How long a level-up success waits for the customer re-read before drawing without it. */
export const LEVEL_UP_READ_MS = 2500;

/**
 * The level this scan moved the customer UP to, or null when nobody moved, the
 * business runs no levels, or the backend predates them.
 */
export function levelUpOf(
  before: LevelBrief | null | undefined,
  after: LevelBrief | null | undefined
): LevelBrief | null {
  if (!before || !after) return null;
  return before.id !== after.id ? after : null;
}

/** The first word of a customer name, or null when there is none. */
export function firstName(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

/** "Camille reached Silver!", or "Reached Silver!" for a customer with no name. */
export function levelUpTitle(
  levelUp: LevelBrief,
  customerName: string | null | undefined,
  translate: Translate
): string {
  const name = firstName(customerName);
  return name
    ? translate("levels.reached", { name, level: levelUp.name })
    : translate("levels.reachedNoName", { level: levelUp.name });
}

/** The words of a perk callout: a title, one line per perk when several, a hint. */
export interface PerkCalloutContent {
  title: string;
  /** Listed under the title one per line; empty when the title carries the one perk. */
  lines: string[];
  hint: string;
}

function perksOf(level: Pick<ProgramLevel, "perks"> | null | undefined): string[] {
  if (!Array.isArray(level?.perks)) return [];
  return level.perks
    .filter((perk): perk is string => typeof perk === "string")
    .map((perk) => perk.trim())
    .filter(Boolean);
}

/** What to tell the employee to apply before charging, or null with no perks. */
export function perkCallout(
  level: Pick<ProgramLevel, "name" | "perks"> | null | undefined,
  translate: Translate
): PerkCalloutContent | null {
  const perks = perksOf(level);
  if (!level || perks.length === 0) return null;
  if (perks.length === 1) {
    return {
      title: translate("levels.perkTitle", { level: level.name, perk: perks[0] }),
      lines: [],
      hint: translate("levels.perkHintOne"),
    };
  }
  return {
    title: translate("levels.perksTitle", { level: level.name }),
    lines: perks,
    hint: translate("levels.perkHintMany"),
  };
}

/**
 * The refreshed customer's level when it is the one just reached and carries
 * perks, else null (the success screen then says what their card shows).
 */
export function perksForLevelUp(
  levelUp: LevelBrief,
  current: ProgramLevel | null | undefined
): ProgramLevel | null {
  if (!current || current.id !== levelUp.id) return null;
  return perksOf(current).length > 0 ? current : null;
}

/**
 * Stamps on the customer's card. The customer endpoint already reports the card
 * of their level; the level snapshot is the fallback, then the design, then the
 * default.
 */
export function stampCardSize(
  customer: Pick<Customer, "total_stamps" | "program">,
  designTotal: number | null | undefined
): number {
  return (
    customer.total_stamps ??
    customer.program?.level?.total_stamps ??
    designTotal ??
    DEFAULT_CARD_SIZE
  );
}

/**
 * After a scan that moved the customer up, read them again so the success
 * screen shows the new card and perks. Null when nobody moved or the read
 * fails: the scan already counted, so a failed read never becomes an error.
 */
export async function freshCustomerOnLevelUp(
  result: Pick<StampResponse, "level_before" | "level_after">,
  read: () => Promise<Customer>
): Promise<Customer | null> {
  if (!levelUpOf(result.level_before, result.level_after)) return null;
  try {
    return await read();
  } catch {
    return null;
  }
}
