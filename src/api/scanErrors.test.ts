/**
 * The three counter mutations map a transport-level failure onto the codes the
 * confirmation screens already branch on. Routing them through `apiFetch`
 * (STA-340) moved that mapping out of the response handling and into these pure
 * functions, so the ladder each screen sees is pinned rather than implied.
 */

import { describe, expect, it } from "bun:test";
import { ApiError } from "./errors";
import { mapPointsError, mapRedeemError, mapStampError } from "./scanErrors";
import { errorCode, errorStatus } from "../utils/apiErrors";

/** What `apiFetch` throws for a gated response. */
function gate(status: number, code: string, detail: Record<string, unknown> = {}) {
  return new ApiError("Some English sentence from the server.", status, code, {
    code,
    message: "Some English sentence from the server.",
    ...detail,
  });
}

describe("mapStampError", () => {
  it("re-raises every gate the screen explains for itself", () => {
    for (const code of [
      "MEMBER_PAUSED",
      "CHECKOUT_REQUIRED",
      "BILLING_REQUIRED",
      "LOCATION_REQUIRED",
      "LOCATION_NOT_PERMITTED",
      "LOCATION_NOT_FOUND",
      "AMOUNT_REQUIRED",
      "EARNING_CAP_REACHED",
      "CAP_OVERRIDE_NOT_ALLOWED",
    ]) {
      expect(errorCode(mapStampError(gate(403, code)))).toBe(code);
    }
  });

  it("keeps the cap payload, which is the whole of what the blocked screen shows", () => {
    const mapped = mapStampError(
      gate(409, "EARNING_CAP_REACHED", {
        scope: "week",
        limit: 5,
        resets_at: "2026-09-28T00:00:00Z",
        can_override: true,
      })
    );

    expect((mapped as { detail?: Record<string, unknown> }).detail).toMatchObject({
      scope: "week",
      limit: 5,
      can_override: true,
    });
  });

  it("never lets the backend's English out as the message", () => {
    // The screen resolves a CODE to localized copy. A sentence that escapes
    // here is an English banner on a French counter, and it looks plausible
    // enough that nobody reports it.
    const mapped = mapStampError(gate(403, "BILLING_REQUIRED"));

    expect(mapped.message).toBe("BILLING_REQUIRED");
  });

  it("maps the bare statuses the backend answers with no code at all", () => {
    expect(errorCode(mapStampError(new ApiError("Not authenticated", 401)))).toBe("UNAUTHORIZED");
    expect(errorCode(mapStampError(new ApiError("Forbidden", 403)))).toBe("ACCESS_DENIED");
    expect(errorCode(mapStampError(new ApiError("Customer not found", 404)))).toBe(
      "ENROLLMENT_NOT_FOUND"
    );
    expect(errorCode(mapStampError(new ApiError("API error: 500", 500)))).toBe("STAMP_FAILED");
  });

  it("passes a transport verdict straight through", () => {
    // The screen decides what a timeout means (reconcile) and what an
    // unreachable server means (offline). Flattening either into STAMP_FAILED
    // would cost the customer their reconcile.
    for (const code of ["REQUEST_TIMEOUT", "NETWORK_UNREACHABLE"]) {
      const transport = new ApiError(code, 0, code);
      expect(mapStampError(transport)).toBe(transport);
    }
  });

  it("passes the client-key conflict through untouched", () => {
    const conflict = new ApiError("CLIENT_KEY_CONFLICT", 409, "CLIENT_KEY_CONFLICT");

    expect(mapStampError(conflict)).toBe(conflict);
  });
});

describe("mapRedeemError", () => {
  it("re-raises the three gates this route can answer with", () => {
    for (const code of ["CHECKOUT_REQUIRED", "BILLING_REQUIRED", "MEMBER_PAUSED"]) {
      expect(errorCode(mapRedeemError(gate(402, code)))).toBe(code);
    }
  });

  it("keeps a coded 400 exactly as the backend sent it", () => {
    // REWARD_UNAVAILABLE / an expired instance: the code drives the copy that
    // says WHY, instead of a generic red banner.
    const expired = gate(400, "REWARD_UNAVAILABLE");

    expect(mapRedeemError(expired)).toBe(expired);
  });

  it("gives the one uncoded 400 a code, so the screen can say something useful", () => {
    // "Not eligible for redemption" is the only plain-string 400 this route
    // raises, and it arrives with no code at all.
    const plain = new ApiError("Not eligible for redemption", 400);

    expect(errorCode(mapRedeemError(plain))).toBe("NOT_ELIGIBLE");
  });

  it("maps the bare statuses", () => {
    expect(errorCode(mapRedeemError(new ApiError("x", 401)))).toBe("UNAUTHORIZED");
    expect(errorCode(mapRedeemError(new ApiError("x", 403)))).toBe("ACCESS_DENIED");
    expect(errorCode(mapRedeemError(new ApiError("x", 404)))).toBe("ENROLLMENT_NOT_FOUND");
    expect(errorCode(mapRedeemError(new ApiError("x", 500)))).toBe("REDEEM_FAILED");
  });

  it("leaves an uncoded 402 as a generic failure, as it always has", () => {
    expect(errorCode(mapRedeemError(new ApiError("x", 402)))).toBe("REDEEM_FAILED");
  });

  it("passes a transport verdict straight through", () => {
    const timeout = new ApiError("REQUEST_TIMEOUT", 0, "REQUEST_TIMEOUT");

    expect(mapRedeemError(timeout)).toBe(timeout);
  });
});

describe("mapPointsError", () => {
  it("re-raises every gate the keypad explains for itself", () => {
    for (const code of [
      "AMOUNT_REQUIRED",
      "MEMBER_PAUSED",
      "CHECKOUT_REQUIRED",
      "BILLING_REQUIRED",
      "LOCATION_REQUIRED",
      "LOCATION_NOT_PERMITTED",
      "LOCATION_NOT_FOUND",
      "EARNING_CAP_REACHED",
      "CAP_OVERRIDE_NOT_ALLOWED",
    ]) {
      expect(errorCode(mapPointsError(gate(403, code)))).toBe(code);
    }
  });

  it("keeps the cap payload", () => {
    const mapped = mapPointsError(gate(409, "EARNING_CAP_REACHED", { scope: "day", limit: 100 }));

    expect((mapped as { detail?: Record<string, unknown> }).detail).toMatchObject({
      scope: "day",
      limit: 100,
    });
  });

  it("maps a real permissions failure to ACCESS_DENIED", () => {
    expect(errorCode(mapPointsError(new ApiError("x", 403)))).toBe("ACCESS_DENIED");
  });

  it("leaves the uncoded failures uncoded, exactly as this route always has", () => {
    // PointsFlow answers an unmapped error with its own `errors.addFailed`
    // copy, so these never reach a customer-facing string. Coding them here
    // would silently change which banner the employee reads (a 401 would start
    // saying "your session expired"), which is not this stage's business.
    expect(errorCode(mapPointsError(new ApiError("x", 401)))).toBeUndefined();
    expect(errorCode(mapPointsError(new ApiError("x", 404)))).toBeUndefined();
    expect(errorCode(mapPointsError(new ApiError("x", 500)))).toBeUndefined();
    expect(errorStatus(mapPointsError(new ApiError("x", 500)))).toBeUndefined();
  });

  it("passes a transport verdict straight through", () => {
    const offline = new ApiError("NETWORK_UNREACHABLE", 0, "NETWORK_UNREACHABLE");

    expect(mapPointsError(offline)).toBe(offline);
  });
});
