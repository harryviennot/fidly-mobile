import { describe, expect, it } from "bun:test";

import { createSelectionOwner } from "./business-selection";

/** The user id on each render after mount, and whether that render drops the stored shop. */
function forgetsOn(mountedWith: string | undefined, renders: (string | undefined)[]) {
  const owner = createSelectionOwner(mountedWith);
  return renders.map((userId) => owner.userIs(userId));
}

describe("when the scanner forgets the shop an employee picked", () => {
  it.each([
    // Mount, then auth restores the session: the shop survives the relaunch.
    ["a cold start that restores the session", undefined, [undefined, "employee-1"], [false, false]],
    ["re-renders for the same employee", "employee-1", ["employee-1", "employee-1"], [false, false]],
    ["the employee signing out", "employee-1", [undefined], [true]],
    // Signing out drops the shop once; the next person starts fresh.
    ["one employee leaving and another signing in", "employee-1", [undefined, "employee-2"], [true, false]],
    ["a different employee replacing a live session", "employee-1", ["employee-2"], [true]],
    // A session that died while the app was closed: nobody at launch, then B.
    // B keeps the stored id, which only applies if B is on that shop too.
    ["a cold start with a dead session, then someone signing in", undefined, [undefined, "employee-2"], [false, false]],
  ] as const)("%s", (_case, mountedWith, renders, expected) => {
    expect(forgetsOn(mountedWith, [...renders])).toEqual([...expected]);
  });
});
