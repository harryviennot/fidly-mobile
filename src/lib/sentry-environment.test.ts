import { describe, expect, it } from "bun:test";
import { resolveSentryEnvironment } from "./sentry-environment";

describe("resolveSentryEnvironment", () => {
  it("preserves every explicit app variant", () => {
    for (const variant of ["development", "preview", "production"] as const) {
      expect(resolveSentryEnvironment(variant, true)).toBe(variant);
      expect(resolveSentryEnvironment(variant, false)).toBe(variant);
    }
  });

  it("uses development for an unconfigured dev bundle", () => {
    expect(resolveSentryEnvironment(undefined, true)).toBe("development");
  });

  it("uses production for an unconfigured release bundle", () => {
    expect(resolveSentryEnvironment(undefined, false)).toBe("production");
  });

  it("falls back by bundle mode when the configured value is invalid", () => {
    expect(resolveSentryEnvironment("local", true)).toBe("development");
    expect(resolveSentryEnvironment("local", false)).toBe("production");
  });
});
