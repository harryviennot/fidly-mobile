import { describe, expect, it } from "bun:test";
import { resolveWaiveAction } from "./cap";

describe("resolveWaiveAction", () => {
  it("re-sends the scan the server just rejected", () => {
    // The employee already entered the amount and pressed Add; the 409 is the
    // only thing standing between them and a credited scan.
    expect(resolveWaiveAction({ rejectedRequest: true, inputReady: true })).toBe("resubmit");
  });

  it("reopens the entry screen when the block came from the snapshot", () => {
    // Nothing has been entered or sent yet, so there is nothing to re-send.
    expect(resolveWaiveAction({ rejectedRequest: false, inputReady: true })).toBe("return-to-entry");
  });

  it("reopens the entry screen when the input is no longer sendable", () => {
    expect(resolveWaiveAction({ rejectedRequest: true, inputReady: false })).toBe("return-to-entry");
  });

  it("reopens the entry screen when neither holds", () => {
    expect(resolveWaiveAction({ rejectedRequest: false, inputReady: false })).toBe(
      "return-to-entry"
    );
  });
});
