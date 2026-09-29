import { describe, expect, it } from "bun:test";

import { ApiError, toApiError } from "@/api/errors";
import {
  classifyMutationFailure,
  errorCode,
  loadErrorKey,
  redeemErrorKey,
  stampErrorKey,
} from "./apiErrors";

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

describe("classifyMutationFailure", () => {
  it("sends a timed-out scan to the reconcile, not to an error banner", () => {
    // The request may well have landed. Telling the employee it failed is how a
    // customer gets stamped twice.
    expect(classifyMutationFailure(coded("REQUEST_TIMEOUT"))).toBe("timeout");
  });

  it("keeps an unreachable server apart from a timed-out one", () => {
    // Nothing left the phone, so there is nothing to reconcile.
    expect(classifyMutationFailure(coded("NETWORK_UNREACHABLE"))).toBe("offline");
  });

  it("calls the key conflict its own thing, never something to retry", () => {
    // Only reachable through a bug of ours: one key, two different requests.
    // Retrying it in a loop would hammer a 409 forever.
    expect(classifyMutationFailure(coded("CLIENT_KEY_CONFLICT"))).toBe("conflict");
  });

  it("leaves every gate the ladder already explains alone", () => {
    // These screens are unchanged by STA-340: no reconcile, no Retry relabel.
    for (const code of [
      "MEMBER_PAUSED",
      "EARNING_CAP_REACHED",
      "CAP_OVERRIDE_NOT_ALLOWED",
      "CHECKOUT_REQUIRED",
      "BILLING_REQUIRED",
      "ACCESS_DENIED",
      "LOCATION_REQUIRED",
      "LOCATION_NOT_PERMITTED",
      "LOCATION_NOT_FOUND",
      "AMOUNT_REQUIRED",
      "NOT_ELIGIBLE",
      "REWARD_UNAVAILABLE",
      "ENROLLMENT_NOT_FOUND",
      "CUSTOMER_NOT_FOUND",
      "UNAUTHORIZED",
    ]) {
      expect(classifyMutationFailure(coded(code))).toBe("gate");
    }
  });

  it("treats a code it has never seen as a gate, not as something to retry", () => {
    // The backend adds codes. A hardcoded list of the ones this build knows
    // went stale on the next deploy, and the new code fell through to
    // "server": a deliberate refusal got a Retry button that would fetch the
    // same refusal. The ladder's generic copy is the right home for it.
    expect(classifyMutationFailure(coded("SOMETHING_NEW"))).toBe("gate");
  });

  it("treats an UNCODED failure as a server failure, which IS worth retrying", () => {
    // A 500 with no detail, a proxy error page: nothing decided this on
    // purpose, so another tap is a reasonable thing to offer.
    expect(classifyMutationFailure(new ApiError("API error: 500", 500))).toBe("server");
    expect(classifyMutationFailure(new Error("boom"))).toBe("server");
    expect(classifyMutationFailure(undefined)).toBe("server");
  });

  it.each([
    ["STAMP_FAILED", 422],
    ["REDEEM_FAILED", 409],
    ["REDEEM_FAILED", 402],
  ])("keeps %s behind a %i a gate: the fallback wraps a deliberate refusal", (code, status) => {
    expect(classifyMutationFailure(new ApiError(code, status, code))).toBe("gate");
  });

  it.each([
    ["STAMP_FAILED", 0],
    ["REDEEM_FAILED", 0],
    // The redeem lost a compare-and-swap to a concurrent change and wrote
    // nothing, so the same key may be sent again.
    ["PROGRESS_CHANGED", 409],
    ["PROGRESS_CHANGED", 0],
  ])("offers Retry on %s (status %i): a generic failure, not a refusal", (code, status) => {
    expect(classifyMutationFailure(new ApiError(code, status, code))).toBe("server");
  });

  // What each route's mapper turns a 5xx into is pinned in api/scanErrors.test.ts;
  // these are the shapes no mapper produces.
  it.each([
    [500, "SOMETHING_NEW"],
    [500, undefined],
    [507, undefined],
  ])("offers Retry on a %i (code %p), whatever it is coded as", (status, code) => {
    expect(classifyMutationFailure(new ApiError("x", status, code))).toBe("server");
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
