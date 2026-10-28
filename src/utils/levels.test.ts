import { describe, expect, it } from "bun:test";
import stamp from "../locales/en/stamp.json";
import type { Customer, LevelBrief, ProgramLevel, StampResponse } from "../types/api";
import {
  firstName,
  freshCustomerOnLevelUp,
  levelUpOf,
  levelUpTitle,
  perkCallout,
  perksForLevelUp,
  stampCardSize,
} from "./levels";
import { maxStampQuantity } from "./stamps";

const bronze: LevelBrief = { id: "lv-1", name: "Bronze", rank: 1 };
const silver: LevelBrief = { id: "lv-2", name: "Silver", rank: 2 };

function level(over: Partial<ProgramLevel> = {}): ProgramLevel {
  return {
    id: "lv-2",
    name: "Silver",
    rank: 2,
    perks: [],
    total_stamps: 8,
    design_id: "design-silver",
    units_on_level: 0,
    next_id: "lv-3",
    next_name: "Gold",
    units_to_next: 16,
    cards_to_next: 2,
    ...over,
  };
}

/** The English catalog with i18next's `{{var}}` interpolation, so a wrong key fails here. */
function translate(key: string, vars: Record<string, string> = {}): string {
  const found = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], stamp);
  if (typeof found !== "string") throw new Error(`no English string for "${key}"`);
  return found.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => vars[name] ?? "");
}

function customerOn(lv: ProgramLevel | null | undefined, over: Partial<Customer> = {}): Customer {
  return {
    id: "c-1",
    business_id: "b-1",
    name: "Camille Dupont",
    email: "",
    stamps: 0,
    ...over,
    program: lv === undefined ? undefined : ({ type: "stamp", level: lv } as Customer["program"]),
  };
}

describe("levelUpOf", () => {
  it("names the level a scan moved the customer up to", () => {
    expect(levelUpOf(bronze, silver)).toEqual(silver);
  });

  it("is null when the scan moved nobody", () => {
    expect(levelUpOf(silver, { ...silver })).toBeNull();
  });

  it("is null when levels are off", () => {
    expect(levelUpOf(null, null)).toBeNull();
  });

  it("is null against an older backend that sends no level fields", () => {
    expect(levelUpOf(undefined, undefined)).toBeNull();
    expect(levelUpOf(bronze, undefined)).toBeNull();
    expect(levelUpOf(undefined, silver)).toBeNull();
  });
});

describe("levelUpTitle", () => {
  it("says who reached the level, by first name", () => {
    expect(levelUpTitle(silver, "Camille Dupont", translate)).toBe("Camille reached Silver!");
  });

  it.each([null, undefined, "", "   "])("drops the name when there is none (%p)", (name) => {
    expect(levelUpTitle(silver, name, translate)).toBe("Reached Silver!");
  });
});

describe("firstName", () => {
  it("takes the first word and ignores surrounding space", () => {
    expect(firstName("  Camille   Dupont ")).toBe("Camille");
    expect(firstName("Camille")).toBe("Camille");
  });
});

describe("perkCallout", () => {
  it("titles a single perk with the level and the perk", () => {
    expect(perkCallout(level({ perks: ["Free coffee"] }), translate)).toEqual({
      title: "Silver perk: Free coffee",
      lines: [],
      hint: "Apply it at the till before charging.",
    });
  });

  it("lists several perks one per line under a plural title", () => {
    expect(perkCallout(level({ perks: ["Free coffee", "10% off cakes"] }), translate)).toEqual({
      title: "Silver perks:",
      lines: ["Free coffee", "10% off cakes"],
      hint: "Apply them at the till before charging.",
    });
  });

  it("skips blank perks", () => {
    expect(perkCallout(level({ perks: ["  ", "Free coffee", ""] }), translate)?.title).toBe(
      "Silver perk: Free coffee"
    );
  });

  it.each([
    ["no perks", level({ perks: [] })],
    ["no level (levels off)", null],
    ["no level (older backend)", undefined],
    ["a level without a perks field", { ...level(), perks: undefined } as unknown as ProgramLevel],
  ])("shows nothing for %s", (_label, input) => {
    expect(perkCallout(input, translate)).toBeNull();
  });
});

describe("perksForLevelUp", () => {
  const silverWithPerks = level({ perks: ["Free coffee"] });

  it("offers the new level's perks once the refreshed customer is on it", () => {
    expect(perksForLevelUp(silver, silverWithPerks)).toBe(silverWithPerks);
  });

  it("falls back when the refresh failed or is for another level", () => {
    expect(perksForLevelUp(silver, null)).toBeNull();
    expect(perksForLevelUp(silver, undefined)).toBeNull();
    expect(perksForLevelUp(silver, level({ id: "lv-1", perks: ["Welcome tea"] }))).toBeNull();
  });

  it("falls back when the new level has no perks", () => {
    expect(perksForLevelUp(silver, level({ perks: [] }))).toBeNull();
  });
});

describe("stampCardSize", () => {
  it("is the card of the customer's level when levels are on", () => {
    // The backend sends the Silver card (8) in both places.
    expect(stampCardSize(customerOn(level(), { total_stamps: 8 }), 10)).toBe(8);
  });

  it("reads the level's card when the backend sends no top-level size", () => {
    expect(stampCardSize(customerOn(level({ total_stamps: 8 })), 10)).toBe(8);
  });

  it("is unchanged with levels off", () => {
    expect(stampCardSize(customerOn(null, { total_stamps: 12 }), 10)).toBe(12);
  });

  it("is unchanged against an older backend", () => {
    expect(stampCardSize(customerOn(undefined, { total_stamps: 12 }), 10)).toBe(12);
    expect(stampCardSize(customerOn(undefined), 9)).toBe(9);
    expect(stampCardSize(customerOn(undefined), undefined)).toBe(10);
  });

  it("falls back to the default card for a points level that carries no size", () => {
    expect(stampCardSize(customerOn(level({ total_stamps: null })), undefined)).toBe(10);
  });
});

describe("the multi-stamp stepper on a Silver customer", () => {
  it("is sized by the Silver card, not the Bronze one", () => {
    const silverCustomer = customerOn(level(), { total_stamps: 8, stamps: 6 });
    const size = stampCardSize(silverCustomer, 10);
    // Levels always stack, so one scan may fill the card and start the next.
    expect(maxStampQuantity({ totalStamps: size, currentStamps: 6, stackable: true })).toBe(8);
    expect(maxStampQuantity({ totalStamps: size, currentStamps: 6, stackable: false })).toBe(2);
  });
});

describe("freshCustomerOnLevelUp", () => {
  const scan = (over: Partial<StampResponse> = {}): StampResponse => ({
    customer_id: "c-1",
    name: "Camille Dupont",
    stamps: 0,
    message: "",
    level_before: bronze,
    level_after: silver,
    ...over,
  });
  const fresh = customerOn(level({ perks: ["Free coffee"] }));

  it("re-reads the customer when the scan moved them up", async () => {
    expect(await freshCustomerOnLevelUp(scan(), async () => fresh)).toBe(fresh);
  });

  it.each([
    ["stayed on the level", scan({ level_before: silver })],
    ["is on a program without levels", scan({ level_before: null, level_after: null })],
    ["was scanned by an older backend", scan({ level_before: undefined, level_after: undefined })],
  ])("does not read anything when the customer %s", async (_label, result) => {
    let reads = 0;
    const read = async () => {
      reads += 1;
      return fresh;
    };
    expect(await freshCustomerOnLevelUp(result, read)).toBeNull();
    expect(reads).toBe(0);
  });

  it("answers null, never an error, when the read fails: the scan already counted", async () => {
    const failing = async (): Promise<Customer> => {
      throw new Error("offline");
    };
    expect(await freshCustomerOnLevelUp(scan(), failing)).toBeNull();
  });
});
