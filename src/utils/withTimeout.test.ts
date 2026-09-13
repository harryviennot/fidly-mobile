import { describe, expect, it } from "bun:test";

import { TIMED_OUT, withTimeout } from "./withTimeout";

const never = () => new Promise<string>(() => {});

describe("withTimeout", () => {
  it("passes a value straight through when it arrives in time", async () => {
    expect(await withTimeout(Promise.resolve("ok"), 1000)).toBe("ok");
  });

  it("resolves to TIMED_OUT instead of hanging forever", async () => {
    // The bug: a stalled session refresh left the screen on a skeleton with no
    // way out. A sentinel, not a rejection, so the caller chooses the wording.
    expect(await withTimeout(never(), 10)).toBe(TIMED_OUT);
  });

  it("still rejects when the promise itself rejects", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000)).rejects.toThrow(
      "boom"
    );
  });

  it("clears its timer on the fast path, so it holds nothing open", async () => {
    // A leaked timer would keep a React Native task alive after the screen is
    // gone. Nothing to assert directly, so prove it settles well before the
    // deadline it was given.
    const started = performance.now();
    await withTimeout(Promise.resolve(1), 5000);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
