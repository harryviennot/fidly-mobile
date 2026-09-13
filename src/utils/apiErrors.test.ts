import { describe, expect, it } from "bun:test";

import { ApiError, toApiError } from "@/api/errors";
import { errorCode, loadErrorKey, redeemErrorKey, stampErrorKey } from "./apiErrors";

function coded(code: string) {
  const err = new Error(code) as Error & { code: string };
  err.code = code;
  return err;
}

describe("the wire shapes a refused redemption arrives in", () => {
  it("reads the coded object shape", () => {
    const err = toApiError(
      { detail: { code: "REWARD_UNAVAILABLE", message: "This reward has already been redeemed." } },
      400,
      "NOT_ELIGIBLE"
    );
    expect(err.code).toBe("REWARD_UNAVAILABLE");
    expect(redeemErrorKey(err)).toBe("errors.rewardUnavailable");
  });

  it("leaves a plain-string detail uncoded, so the caller supplies one", () => {
    // This is the shape that broke: `new Error(detail)` on the OBJECT shape
    // renders "[object Object]" in the banner. Everything goes through the
    // parser now, and the one string 400 this route raises is "not eligible".
    const err = toApiError({ detail: "Not eligible for redemption" }, 400, "NOT_ELIGIBLE");
    expect(err.code).toBeUndefined();
    expect(redeemErrorKey(err)).toBe("errors.redeemFailed");
    // ...which is why the client tags it explicitly:
    expect(redeemErrorKey(new ApiError("NOT_ELIGIBLE", 400, "NOT_ELIGIBLE"))).toBe(
      "errors.notEligible"
    );
  });

  it("survives an empty body", () => {
    expect(toApiError({}, 400, "NOT_ELIGIBLE").code).toBeUndefined();
    expect(toApiError(null, 500, "REDEEM_FAILED").message).toBe("REDEEM_FAILED");
  });
});

describe("errorCode", () => {
  it("finds a code on our errors and nothing on a plain one", () => {
    expect(errorCode(coded("REWARD_UNAVAILABLE"))).toBe("REWARD_UNAVAILABLE");
    expect(errorCode(new Error("boom"))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode("REWARD_UNAVAILABLE")).toBeUndefined();
  });
});

describe("redeemErrorKey", () => {
  it("names the real reason when the backend gives one", () => {
    // The whole point of RE-02: the employee is looking at the customer and
    // needs "that reward has expired", not "something went wrong".
    expect(redeemErrorKey(coded("REWARD_UNAVAILABLE"))).toBe("errors.rewardUnavailable");
    expect(redeemErrorKey(coded("NOT_ELIGIBLE"))).toBe("errors.notEligible");
    expect(redeemErrorKey(coded("ENROLLMENT_NOT_FOUND"))).toBe("errors.cardNotRecognised");
  });

  it("falls back to the generic failure, never to the server's English", () => {
    expect(redeemErrorKey(new Error("Failed to redeem reward"))).toBe("errors.redeemFailed");
    expect(redeemErrorKey(coded("SOMETHING_NEW"))).toBe("errors.redeemFailed");
    expect(redeemErrorKey(undefined)).toBe("errors.redeemFailed");
  });
});

describe("stampErrorKey", () => {
  it("keeps the stamp route's own special case", () => {
    expect(stampErrorKey(coded("AMOUNT_REQUIRED"))).toBe("errors.programNowPoints");
  });

  it("shares the common codes and its own fallback", () => {
    expect(stampErrorKey(coded("ACCESS_DENIED"))).toBe("errors.accessDenied");
    expect(stampErrorKey(new Error("nope"))).toBe("errors.stampFailed");
  });
});

describe("loadErrorKey", () => {
  it("translates FastAPI's uncoded 404, which used to reach the counter in English", () => {
    // `GET /customers/...` answers `detail: "Customer not found"` — a plain
    // string, so `toApiError` gives it no code. Status is the only signal.
    const err = toApiError({ detail: "Customer not found" }, 404, "load failed");
    expect(err.code).toBeUndefined();
    expect(loadErrorKey(err)).toBe("errors.cardNotRecognised");
  });

  it("tells an expired session apart from a broken card", () => {
    expect(loadErrorKey(toApiError({ detail: "Not authenticated" }, 401, "x"))).toBe(
      "errors.unauthorized"
    );
    expect(loadErrorKey(toApiError({}, 403, "x"))).toBe("errors.unauthorized");
  });

  it("falls back for anything else, including a non-API error", () => {
    expect(loadErrorKey(toApiError({}, 500, "x"))).toBe("errors.loadFailed");
    expect(loadErrorKey(new Error("network down"))).toBe("errors.loadFailed");
    expect(loadErrorKey(undefined)).toBe("errors.loadFailed");
  });
});
