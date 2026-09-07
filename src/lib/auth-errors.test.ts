import { describe, expect, it } from "bun:test";
import { classifyAuthError, type AuthErrorKey } from "./auth-errors";

describe("classifyAuthError", () => {
  it("maps wrong password to invalidCredentials", () => {
    for (const m of [
      "Invalid login credentials",
      "invalid credentials",
      "Invalid password",
    ]) {
      expect(classifyAuthError(m)).toBe("invalidCredentials");
    }
  });

  it("maps throttling to tooManyRequests", () => {
    for (const m of [
      "Request rate limit reached",
      "Too many requests",
      "429 Too Many Requests",
    ]) {
      expect(classifyAuthError(m)).toBe("tooManyRequests");
    }
  });

  it("maps a missing account to userNotFound", () => {
    expect(classifyAuthError("User not found")).toBe("userNotFound");
    expect(classifyAuthError("no user found for this email")).toBe("userNotFound");
  });

  it("maps transport failures to networkError", () => {
    expect(classifyAuthError("Network request failed")).toBe("networkError");
    expect(classifyAuthError("TypeError: Failed to fetch")).toBe("networkError");
  });

  // STA-246: the two real production failures. Both mean "the provider is
  // misconfigured", which is nothing the employee can fix -- so they must be
  // told to use another method rather than to try again.
  it("maps the Supabase audience rejection to providerUnavailable", () => {
    expect(classifyAuthError("Unacceptable audience in id_token")).toBe(
      "providerUnavailable"
    );
  });

  it("maps Android DEVELOPER_ERROR to providerUnavailable", () => {
    expect(classifyAuthError("Something went wrong", "10")).toBe(
      "providerUnavailable"
    );
    expect(classifyAuthError("DEVELOPER_ERROR")).toBe("providerUnavailable");
  });

  it("maps a missing SDK configuration to providerUnavailable", () => {
    expect(
      classifyAuthError("You must specify |clientID| in |GIDConfiguration|")
    ).toBe("providerUnavailable");
  });

  it("maps a missing native module to providerUnavailable", () => {
    expect(classifyAuthError("Google sign-in is unavailable in this build")).toBe(
      "providerUnavailable"
    );
  });

  it("does not mistake an unrelated numeric code for DEVELOPER_ERROR", () => {
    expect(classifyAuthError("Something went wrong", "12501")).toBe("generic");
  });

  it("falls back to generic", () => {
    expect(classifyAuthError("kaboom")).toBe("generic");
    expect(classifyAuthError("")).toBe("generic");
    expect(classifyAuthError(undefined)).toBe("generic");
  });

  it("returns keys that all exist in the login catalog", async () => {
    const en = await import("../locales/en/login.json");
    const keys: AuthErrorKey[] = [
      "invalidCredentials",
      "tooManyRequests",
      "userNotFound",
      "networkError",
      "providerUnavailable",
      "generic",
    ];
    for (const key of keys) {
      expect(en.default.errors).toHaveProperty(key);
    }
  });
});
