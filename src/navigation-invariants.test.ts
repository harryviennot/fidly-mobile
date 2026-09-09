/**
 * Guards on how screens navigate, checked against the source itself.
 *
 * The rule this pins down: **returning to the lobby pops back to it, never
 * pushes or replaces a second copy of it.** The lobby is the root of the
 * signed-in stack, so `replace("/lobby")` from a screen that was pushed on top
 * of it leaves two lobbies in the stack. Every round trip added another one:
 * open the tour from the lobby, press "Start scanning", and you are on a lobby
 * with a lobby underneath it, so back goes... to the lobby.
 *
 * `router.dismissTo("/lobby")` is the primitive that does the right thing in
 * both situations. React Navigation's POP_TO pops to the existing lobby when
 * there is one below, and otherwise replaces the current screen with it, so
 * the stack depth stays put whichever way the screen was reached.
 *
 * This is a source scan rather than a navigation harness because the bug is not
 * in any function we could call: it is in which router method a screen picks.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = import.meta.dir;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === "node_modules" ? [] : sourceFiles(path);
    }
    if (!/\.tsx?$/.test(entry) || entry.endsWith(".test.ts")) return [];
    return [path];
  });
}

const FILES = sourceFiles(SRC).map((path) => ({
  path: path.slice(SRC.length + 1),
  text: readFileSync(path, "utf8"),
}));

describe("returning to the lobby", () => {
  test.each(["replace", "push", "navigate"])(
    "no screen uses router.%s to get back to the lobby",
    (method) => {
      const offenders = FILES.filter((f) =>
        new RegExp(`router\\.${method}\\(\\s*["'\`]/lobby`).test(f.text),
      ).map((f) => f.path);

      expect(offenders).toEqual([]);
    },
  );

  test("the tour hands the employee back to the lobby", () => {
    const tour = FILES.find((f) => f.path.endsWith("onboarding.tsx"));
    const method = tour?.text.match(/router\.(\w+)\(\s*["'`]\/lobby/)?.[1];

    expect(method).toBe("dismissTo");
  });
});
