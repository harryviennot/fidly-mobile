import { describe, expect, test } from "bun:test";
import { joinScreenState } from "./join-screen-state";

describe("joinScreenState", () => {
  test("signed out: cancel goes back to welcome, no escape needed", () => {
    expect(joinScreenState({ signedIn: false, membershipCount: 0 })).toEqual({
      canCancel: true,
      showEscapeHatch: false,
    });
  });

  test("signed in with a shop already: cancel returns to the list", () => {
    // Staff adding a second shop. They are not stuck.
    expect(joinScreenState({ signedIn: true, membershipCount: 1 })).toEqual({
      canCancel: true,
      showEscapeHatch: false,
    });
  });

  test("signed in with no membership gets the escape hatch instead of cancel", () => {
    // Cancel has nowhere to go, so the way out is create-a-business or sign out.
    expect(joinScreenState({ signedIn: true, membershipCount: 0 })).toEqual({
      canCancel: false,
      showEscapeHatch: true,
    });
  });

  test.each([
    ["signed out", { signedIn: false, membershipCount: 0 }],
    ["signed out with stale count", { signedIn: false, membershipCount: 3 }],
    ["fresh account", { signedIn: true, membershipCount: 0 }],
    ["one shop", { signedIn: true, membershipCount: 1 }],
    ["many shops", { signedIn: true, membershipCount: 7 }],
  ])("%s is never a dead end", (_label, viewer) => {
    // The invariant the whole screen rests on: some way out always exists.
    // Both flags false is the STA-246 bug, where a successful sign-in looked
    // like a failure because it landed on a screen with no exit.
    const state = joinScreenState(viewer);
    expect(state.canCancel || state.showEscapeHatch).toBe(true);
  });
});
