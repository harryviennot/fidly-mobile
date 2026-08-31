import { describe, expect, it } from "bun:test";
import { selectPluralForm } from "./plural";

describe("selectPluralForm (Polish)", () => {
  it("uses the singular for exactly 1", () => {
    expect(selectPluralForm("pl", 1)).toBe("one");
  });

  it("uses `few` for 2 through 4", () => {
    // 2 pieczątki, 3 pieczątki, 4 pieczątki
    expect(selectPluralForm("pl", 2)).toBe("few");
    expect(selectPluralForm("pl", 3)).toBe("few");
    expect(selectPluralForm("pl", 4)).toBe("few");
  });

  it("uses `many` from 5 up", () => {
    // 5 pieczątek
    expect(selectPluralForm("pl", 5)).toBe("many");
    expect(selectPluralForm("pl", 9)).toBe("many");
    expect(selectPluralForm("pl", 21)).toBe("many");
  });

  it("uses `many` for zero", () => {
    // 0 pieczątek, not 0 pieczątka
    expect(selectPluralForm("pl", 0)).toBe("many");
  });

  it("keeps the teens on `many`, even though they end in 2-4", () => {
    // The boundary a hand-written rule gets wrong: 12-14 are `many`.
    expect(selectPluralForm("pl", 12)).toBe("many");
    expect(selectPluralForm("pl", 13)).toBe("many");
    expect(selectPluralForm("pl", 14)).toBe("many");
    expect(selectPluralForm("pl", 112)).toBe("many");
    expect(selectPluralForm("pl", 114)).toBe("many");
  });

  it("goes back to `few` above the teens", () => {
    // 22 pieczątki, but 25 pieczątek.
    expect(selectPluralForm("pl", 22)).toBe("few");
    expect(selectPluralForm("pl", 23)).toBe("few");
    expect(selectPluralForm("pl", 24)).toBe("few");
    expect(selectPluralForm("pl", 25)).toBe("many");
  });

  it("treats a trailing 1 above 1 as `many`", () => {
    // 21 pieczątek and 101 pieczątek, never the singular.
    expect(selectPluralForm("pl", 21)).toBe("many");
    expect(selectPluralForm("pl", 101)).toBe("many");
  });

  it("applies the rule to hundreds by the last two digits", () => {
    expect(selectPluralForm("pl", 102)).toBe("few");
    expect(selectPluralForm("pl", 105)).toBe("many");
    expect(selectPluralForm("pl", 100)).toBe("many");
  });

  it("puts fractions in `other`", () => {
    // 1,5 pieczątki
    expect(selectPluralForm("pl", 1.5)).toBe("other");
    expect(selectPluralForm("pl", 0.5)).toBe("other");
  });

  it("accepts a regional tag", () => {
    expect(selectPluralForm("pl-PL", 5)).toBe("many");
    expect(selectPluralForm("pl_PL", 2)).toBe("few");
    expect(selectPluralForm("PL", 2)).toBe("few");
  });

  it("survives a broken count instead of guessing a noun form", () => {
    expect(selectPluralForm("pl", NaN)).toBe("other");
    expect(selectPluralForm("pl", Infinity)).toBe("other");
  });
});

describe("selectPluralForm (every other locale)", () => {
  it("is singular at 1 and plural everywhere else", () => {
    for (const locale of ["en", "fr", "es"]) {
      expect(selectPluralForm(locale, 1)).toBe("one");
      expect(selectPluralForm(locale, 0)).toBe("other");
      expect(selectPluralForm(locale, 2)).toBe("other");
      expect(selectPluralForm(locale, 5)).toBe("other");
      expect(selectPluralForm(locale, 22)).toBe("other");
    }
  });

  it("never returns a Polish-only form", () => {
    expect(selectPluralForm("en-GB", 3)).toBe("other");
    expect(selectPluralForm("es-ES", 12)).toBe("other");
  });

  it("falls back to the binary rule when the language is unknown", () => {
    expect(selectPluralForm(undefined, 1)).toBe("one");
    expect(selectPluralForm(null, 4)).toBe("other");
    expect(selectPluralForm("", 4)).toBe("other");
  });
});
