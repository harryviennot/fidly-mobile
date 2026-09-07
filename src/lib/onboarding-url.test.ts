import { describe, expect, test } from "bun:test";
import { buildOnboardingUrl, SHOWCASE_BASE_URL } from "./onboarding-url";

describe("buildOnboardingUrl", () => {
  test.each(["en", "fr", "es", "pl"])(
    "serves the owner the %s onboarding on the showcase",
    (locale) => {
      expect(buildOnboardingUrl(locale)).toBe(
        `${SHOWCASE_BASE_URL}/${locale}/onboarding`,
      );
    },
  );

  test("resolves a regional tag to the base language", () => {
    expect(buildOnboardingUrl("pl-PL")).toBe(`${SHOWCASE_BASE_URL}/pl/onboarding`);
  });

  test.each([undefined, null, "", "de", "zz-ZZ"])(
    "falls back to English for %p",
    (locale) => {
      expect(buildOnboardingUrl(locale)).toBe(`${SHOWCASE_BASE_URL}/en/onboarding`);
    },
  );

  test("points at the showcase, never the dashboard", () => {
    // Business signup lives on stampeo.app; app.stampeo.app has no /onboarding
    // entry for a user with no account yet.
    expect(SHOWCASE_BASE_URL).toBe("https://stampeo.app");
    expect(buildOnboardingUrl("fr")).not.toContain("app.stampeo.app");
  });
});
