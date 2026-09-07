import { describe, expect, it } from "bun:test";
import {
  buildOnboardingSlides,
  onboardingStorageKey,
  shouldAutoShowOnboarding,
} from "./scanner-onboarding";

describe("buildOnboardingSlides", () => {
  it("always opens with the counter QR then scanning", () => {
    const slides = buildOnboardingSlides({ programType: "stamp", showLocations: false });
    expect(slides.slice(0, 2)).toEqual(["counterQr", "scanning"]);
  });

  it("shows the stamp slide for a stamp program", () => {
    expect(buildOnboardingSlides({ programType: "stamp", showLocations: false }))
      .toEqual(["counterQr", "scanning", "stamp"]);
  });

  it("shows the points slide for a points program", () => {
    expect(buildOnboardingSlides({ programType: "points", showLocations: false }))
      .toEqual(["counterQr", "scanning", "points"]);
  });

  it("never shows both engine slides", () => {
    for (const programType of ["stamp", "points"] as const) {
      const slides = buildOnboardingSlides({ programType, showLocations: true });
      const engines = slides.filter((s) => s === "stamp" || s === "points");
      expect(engines).toHaveLength(1);
    }
  });

  it("omits the engine slide when the program type is unknown", () => {
    expect(buildOnboardingSlides({ programType: null, showLocations: false }))
      .toEqual(["counterQr", "scanning"]);
  });

  it("appends the locations slide only when the employee can switch venue", () => {
    expect(buildOnboardingSlides({ programType: "points", showLocations: true }))
      .toEqual(["counterQr", "scanning", "points", "locations"]);
    expect(buildOnboardingSlides({ programType: "points", showLocations: false }))
      .not.toContain("locations");
  });
});

describe("onboardingStorageKey", () => {
  it("scopes to the business", () => {
    expect(onboardingStorageKey("biz-1", "stamp"))
      .not.toBe(onboardingStorageKey("biz-2", "stamp"));
  });

  it("scopes to the program type so a conversion replays the tour", () => {
    expect(onboardingStorageKey("biz-1", "stamp"))
      .not.toBe(onboardingStorageKey("biz-1", "points"));
  });

  it("is stable for the same inputs", () => {
    expect(onboardingStorageKey("biz-1", "stamp"))
      .toBe(onboardingStorageKey("biz-1", "stamp"));
  });

  it("handles an unknown program type without colliding with a real one", () => {
    const unknown = onboardingStorageKey("biz-1", null);
    expect(unknown).toContain("unknown");
    expect(unknown).not.toBe(onboardingStorageKey("biz-1", "stamp"));
  });
});

describe("shouldAutoShowOnboarding", () => {
  const base = { seen: false, programType: "stamp" as const, businessId: "biz-1" };

  it("opens for a new employee on a known program", () => {
    expect(shouldAutoShowOnboarding(base)).toBe(true);
  });

  it("stays closed once seen", () => {
    expect(shouldAutoShowOnboarding({ ...base, seen: true })).toBe(false);
  });

  it("waits rather than guessing the engine", () => {
    expect(shouldAutoShowOnboarding({ ...base, programType: null })).toBe(false);
  });

  it("stays closed with no business selected", () => {
    expect(shouldAutoShowOnboarding({ ...base, businessId: null })).toBe(false);
  });
});
