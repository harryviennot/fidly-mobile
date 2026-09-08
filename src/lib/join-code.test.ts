import { describe, expect, it } from "bun:test";
import {
  JOIN_CODE_ALPHABET,
  JOIN_ERROR_KEYS,
  formatJoinCode,
  isValidJoinCode,
  isPendingCodeFresh,
  joinErrorKey,
  keepPendingCodeAfterFailure,
  normalizeJoinCode,
  PENDING_CODE_TTL_MS,
  sanitizeJoinCodeInput,
  shouldDropParkedCodeAfterSignIn,
  shouldResumeParkedCode,
} from "./join-code";

describe("alphabet", () => {
  it("excludes every confusable character", () => {
    for (const c of "01ILOU") {
      expect(JOIN_CODE_ALPHABET).not.toContain(c);
    }
  });

  it("is 30 distinct symbols", () => {
    expect(JOIN_CODE_ALPHABET.length).toBe(30);
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(30);
  });
});

describe("normalizeJoinCode", () => {
  // This table is the contract shared with backend/tests/test_join_codes.py.
  const cases: [string | null | undefined, string][] = [
    ["abcd3f", "ABCD3F"],
    ["ABC-D3F", "ABCD3F"],
    ["abc-d3f", "ABCD3F"],
    [" ABC D3F ", "ABCD3F"],
    ["a b c d 3 f", "ABCD3F"],
    ["ABC–D3F", "ABCD3F"], // en dash
    ["ABC—D3F", "ABCD3F"], // em dash
    ["abc_d3f", "ABCD3F"],
    ["", ""],
    [null, ""],
    [undefined, ""],
    ["   ", ""],
  ];

  for (const [raw, expected] of cases) {
    it(`normalizes ${JSON.stringify(raw)} to ${JSON.stringify(expected)}`, () => {
      expect(normalizeJoinCode(raw)).toBe(expected);
    });
  }

  it("keeps confusable characters so they can be rejected", () => {
    expect(normalizeJoinCode("ABCO3F")).toBe("ABCO3F");
    expect(isValidJoinCode("ABCO3F")).toBe(false);
  });
});

describe("isValidJoinCode", () => {
  it("accepts a well-formed code", () => {
    expect(isValidJoinCode("ABCD3F")).toBe(true);
  });

  it("rejects bad shapes", () => {
    for (const bad of ["ABCD3", "ABCD3FG", "", "ABC03F", "ABCI3F", "ABCL3F", "ABCU3F", "abcd3f"]) {
      expect(isValidJoinCode(bad)).toBe(false);
    }
  });
});

describe("formatJoinCode", () => {
  it("groups in threes", () => {
    expect(formatJoinCode("ABCD3F")).toBe("ABC-D3F");
  });

  it("is idempotent", () => {
    expect(formatJoinCode(formatJoinCode("ABCD3F"))).toBe("ABC-D3F");
  });

  it("does not throw on short input", () => {
    expect(formatJoinCode("AB")).toBe("AB");
    expect(formatJoinCode("")).toBe("");
  });
});

describe("sanitizeJoinCodeInput", () => {
  it("drops characters that can never appear in a code", () => {
    expect(sanitizeJoinCodeInput("O")).toBe("");
    expect(sanitizeJoinCodeInput("ab0cd1e")).toBe("ABCDE");
  });

  it("accepts a pasted formatted code", () => {
    expect(sanitizeJoinCodeInput("abc-d3f")).toBe("ABCD3F");
  });

  it("caps at the code length", () => {
    expect(sanitizeJoinCodeInput("ABCD3FGHJK")).toBe("ABCD3F");
  });
});

describe("joinErrorKey", () => {
  it("maps every backend code to a key that exists in the catalog", async () => {
    const en = await import("../locales/en/join.json");
    for (const code of JOIN_ERROR_KEYS) {
      const key = joinErrorKey(code).split(".")[1];
      expect(en.default.errors).toHaveProperty(key);
    }
    expect(en.default.errors).toHaveProperty("GENERIC");
  });

  it("falls back to GENERIC for an unknown code", () => {
    expect(joinErrorKey("SOMETHING_NEW")).toBe("errors.GENERIC");
    expect(joinErrorKey(undefined)).toBe("errors.GENERIC");
  });
});

describe("isPendingCodeFresh", () => {
  const now = 1_757_000_000_000;

  it("accepts a code saved just now", () => {
    expect(isPendingCodeFresh(now, now)).toBe(true);
  });

  it("accepts a code inside the window", () => {
    expect(isPendingCodeFresh(now - PENDING_CODE_TTL_MS + 1000, now)).toBe(true);
  });

  it("rejects a code past the window", () => {
    expect(isPendingCodeFresh(now - PENDING_CODE_TTL_MS - 1, now)).toBe(false);
  });

  it("rejects a code exactly at the window edge", () => {
    expect(isPendingCodeFresh(now - PENDING_CODE_TTL_MS, now)).toBe(false);
  });

  it("rejects a future timestamp rather than treating it as fresh forever", () => {
    expect(isPendingCodeFresh(now + 60_000, now)).toBe(false);
  });

  it("rejects junk timestamps", () => {
    expect(isPendingCodeFresh(0, now)).toBe(false);
    expect(isPendingCodeFresh(-1, now)).toBe(false);
    expect(isPendingCodeFresh(Number.NaN, now)).toBe(false);
  });
});

describe("keepPendingCodeAfterFailure", () => {
  it("DROPS A CODE THE SERVER HAS ALREADY REJECTED", () => {
    // The bug this exists for. A mistyped code stayed in storage for the full
    // TTL, and the effect that resumes a parked code re-read and re-submitted
    // it on every mount: a memberless employee who fat-fingered one character
    // met the red error again on every cold start for fifteen minutes, with a
    // wasted lookup each time, on the one screen that has no Cancel.
    expect(keepPendingCodeAfterFailure(404)).toBe(false);
    expect(keepPendingCodeAfterFailure(403)).toBe(false);
    expect(keepPendingCodeAfterFailure(409)).toBe(false);
    expect(keepPendingCodeAfterFailure(402)).toBe(false);
    expect(keepPendingCodeAfterFailure(400)).toBe(false);
  });

  it("keeps a code when the request never reached the server", () => {
    // Offline, DNS failure, a dropped connection: fetch throws before there is
    // a status. The code is still good and retyping it is a real cost.
    expect(keepPendingCodeAfterFailure(undefined)).toBe(true);
  });

  it("keeps a code when the server failed rather than answered", () => {
    expect(keepPendingCodeAfterFailure(500)).toBe(true);
    expect(keepPendingCodeAfterFailure(502)).toBe(true);
    expect(keepPendingCodeAfterFailure(503)).toBe(true);
  });

  it("keeps a code that was throttled, since that says nothing about the code", () => {
    expect(keepPendingCodeAfterFailure(429)).toBe(true);
  });

  it("drops on any other answer, so a new gate cannot reinstate the replay", () => {
    // The rule is about who answered, not about which codes we listed: an
    // unrecognised 4xx is still the server telling us about this code.
    expect(keepPendingCodeAfterFailure(418)).toBe(false);
    expect(keepPendingCodeAfterFailure(422)).toBe(false);
  });
});

describe("shouldDropParkedCodeAfterSignIn", () => {
  it("DROPS A CODE STRANDED BY SOMEONE ELSE'S SIGN-IN", () => {
    // Enter a code, then sign in as an account that already has a team: you
    // land on your own lobby, the join screen never mounts, and the code sits
    // in storage for the rest of its fifteen minutes. On a shared counter
    // phone the next person to open the join sheet inherits it — which is
    // exactly how "Join Aurevo?" appeared for a freshly typed Patoune code.
    expect(shouldDropParkedCodeAfterSignIn(1)).toBe(true);
    expect(shouldDropParkedCodeAfterSignIn(4)).toBe(true);
  });

  it("keeps the code when the session that landed has no team", () => {
    // The whole point of parking it: this person is one screen away from
    // using it, and retyping six characters is the cost of getting this wrong.
    expect(shouldDropParkedCodeAfterSignIn(0)).toBe(false);
  });
});

describe("shouldResumeParkedCode", () => {
  const base = { signedIn: true, phase: "code" as const, hasInitialCode: false };

  it("A CODE IN THE ROUTE BEATS A CODE IN STORAGE", () => {
    // The bug this exists for. Typing PTNA45 into the join sheet produced a
    // confirmation headed "Join Aurevo?", because a code parked minutes
    // earlier resumed on mount and overwrote the one just entered. Whatever
    // the person asked about right now wins.
    expect(shouldResumeParkedCode({ ...base, hasInitialCode: true })).toBe(false);
  });

  it("resumes when the screen was opened with nothing in hand", () => {
    // The case it is actually for: back from the sign-in detour, code intact.
    expect(shouldResumeParkedCode(base)).toBe(true);
  });

  it("never resumes once the flow has moved on", () => {
    // Re-running a lookup under a confirmation someone is reading would change
    // what they are about to agree to.
    expect(shouldResumeParkedCode({ ...base, phase: "confirm" })).toBe(false);
    expect(shouldResumeParkedCode({ ...base, phase: "joining" })).toBe(false);
  });

  it("never resumes without a session", () => {
    // The lookup needs one, and a signed-out screen has its own path.
    expect(shouldResumeParkedCode({ ...base, signedIn: false })).toBe(false);
  });
});
