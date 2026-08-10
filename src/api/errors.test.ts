import { describe, expect, it } from "bun:test";
import { ApiError, toApiError } from "./errors";

describe("toApiError", () => {
  it("keeps a plain-string detail as the message", () => {
    const err = toApiError({ detail: "Business not found" }, 404, "fallback");
    expect(err.message).toBe("Business not found");
    expect(err.status).toBe(404);
    expect(err.code).toBeUndefined();
  });

  it("reads the message and code out of a structured detail", () => {
    // This is the shape that used to render as "[object Object]".
    const err = toApiError(
      {
        detail: {
          code: "CHECKOUT_REQUIRED",
          message: "Finish setting up your subscription to use this feature.",
          checkout_required: true,
          reason: "usage_cap",
        },
      },
      402,
      "fallback",
    );
    expect(err.message).toBe(
      "Finish setting up your subscription to use this feature.",
    );
    expect(err.code).toBe("CHECKOUT_REQUIRED");
    expect(err.status).toBe(402);
    expect(err.detail?.reason).toBe("usage_cap");
  });

  it("never stringifies an object into the message", () => {
    const err = toApiError({ detail: { code: "BILLING_REQUIRED" } }, 403, "fallback");
    expect(err.message).not.toContain("[object Object]");
    expect(err.message).toBe("BILLING_REQUIRED");
  });

  it("falls back when the body has no detail", () => {
    expect(toApiError({}, 500, "API error: 500").message).toBe("API error: 500");
    expect(toApiError(null, 500, "API error: 500").message).toBe("API error: 500");
    expect(toApiError(undefined, 500, "API error: 500").message).toBe("API error: 500");
  });

  it("falls back on an empty-string detail", () => {
    expect(toApiError({ detail: "" }, 500, "API error: 500").message).toBe(
      "API error: 500",
    );
  });

  it("ignores a non-string code", () => {
    const err = toApiError({ detail: { code: 42, message: "boom" } }, 400, "fallback");
    expect(err.code).toBeUndefined();
    expect(err.message).toBe("boom");
  });

  it("is an Error, so existing catch blocks keep working", () => {
    const err = toApiError({ detail: { code: "X" } }, 400, "fallback");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});
