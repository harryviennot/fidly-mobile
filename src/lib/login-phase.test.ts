import { describe, expect, test } from "bun:test";
import { backFromPhase, initialAuthPhase } from "./login-phase";

describe("initialAuthPhase", () => {
  test("THE JOIN FLOW ASKS FOR SIGN-UP, NOT A SECOND CHOOSER", () => {
    // The bug this exists for. Someone entering a team code met the provider
    // buttons, tapped "Continue with email", and met the SAME three provider
    // buttons again on a screen headed "Welcome back" — two screens to reach a
    // sign-in form, when what a code holder almost always needs is sign-up.
    expect(initialAuthPhase("signup")).toBe("signup");
  });

  test("opens on the chooser when nobody asked for anything", () => {
    expect(initialAuthPhase(undefined)).toBe("choose");
    expect(initialAuthPhase("")).toBe("choose");
  });

  test("ignores a phase it does not know", () => {
    // The parameter is in a URL, so it can say anything.
    expect(initialAuthPhase("../../etc")).toBe("choose");
    expect(initialAuthPhase("SIGNUP")).toBe("choose");
  });

  test("accepts the credentials form directly too", () => {
    expect(initialAuthPhase("credentials")).toBe("credentials");
  });
});

describe("backFromPhase", () => {
  test("A SEEDED PHASE GOES BACK WHERE IT CAME FROM", () => {
    // Falling through to the chooser would put the duplicate screen back in
    // front of the person we just routed past it.
    expect(backFromPhase({ phase: "signup", seeded: true })).toBe("leave");
    expect(backFromPhase({ phase: "credentials", seeded: true })).toBe("leave");
  });

  test("a phase the user chose goes back to the chooser", () => {
    expect(backFromPhase({ phase: "signup", seeded: false })).toBe("choose");
    expect(backFromPhase({ phase: "credentials", seeded: false })).toBe("choose");
  });

  test("the chooser itself always leaves the screen", () => {
    expect(backFromPhase({ phase: "choose", seeded: false })).toBe("leave");
    expect(backFromPhase({ phase: "choose", seeded: true })).toBe("leave");
  });
});
