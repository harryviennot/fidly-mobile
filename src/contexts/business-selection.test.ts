import { describe, expect, it } from "bun:test";

import { shouldForgetSelectedBusiness } from "./business-selection";

describe("when the scanner forgets the shop an employee picked", () => {
  it.each([
    ["the first render, while auth restores the session", undefined, undefined, false],
    ["the session restored on a cold start", undefined, "employee-1", false],
    ["a re-render for the same employee", "employee-1", "employee-1", false],
    ["the employee signing out", "employee-1", undefined, true],
    ["a different employee on the same phone", "employee-1", "employee-2", true],
  ] as const)("%s", (_case, previousUserId, userId, forget) => {
    expect(shouldForgetSelectedBusiness(previousUserId, userId)).toBe(forget);
  });
});
