/**
 * Guards on the two confirmation flows, checked against the source itself.
 *
 * These are rules about what a COMPONENT does, and this app has no component
 * test runner (per the workspace CLAUDE.md, the scanner's first one would be
 * jest-expo; standing one up is not this stage's job). The rules still have to
 * be pinned, because each of them is one deleted line away from a double credit
 * at a till, so they are checked the way `rewards-menu-props.test.ts` and
 * `src/navigation-invariants.test.ts` check theirs: by reading the source.
 *
 * Every scan below self-checks that it actually found what it was looking for.
 * A parser that quietly matched nothing would pass every assertion.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FLOWS = ["StampFlow.tsx", "PointsFlow.tsx"];

const SOURCES: Record<string, string> = Object.fromEntries(
  FLOWS.map((file) => [file, readFileSync(join(import.meta.dir, file), "utf8")])
);

/**
 * The `{ ... }` block that follows a marker, brace-matched.
 *
 * Throws when the marker is absent, which is itself the guard: deleting the
 * branch fails the test rather than vacuously passing it.
 */
function blockAfter(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`"${marker}" is not in the source any more`);
  const open = source.indexOf("{", start);
  if (open === -1) throw new Error(`no block after "${marker}"`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unterminated block after "${marker}"`);
}

/** The opening JSX tag containing `marker`, e.g. a style name. */
function openingTagAround(source: string, marker: string): string {
  const at = source.indexOf(marker);
  if (at === -1) throw new Error(`"${marker}" is not in the source any more`);
  const start = source.lastIndexOf("<", at);
  for (let i = at; i < source.length; i += 1) {
    // Skip the ">" of an arrow function in a prop value.
    if (source[i] === ">" && source[i - 1] !== "=") return source.slice(start, i + 1);
  }
  throw new Error(`unterminated tag around "${marker}"`);
}

describe("the ways out are locked while a request is in flight", () => {
  // Leaving mid-request and rescanning mints a NEW client key for the same
  // scan, and the backend has no way to know the two are one tap. It is the
  // single double-credit the idempotency key cannot close, which is why these
  // controls are disabled rather than merely discouraged.

  test("the stamp screen's close button is gated on inFlight", () => {
    const tag = openingTagAround(SOURCES["StampFlow.tsx"], "styles.closeButton");
    expect(tag).toContain("disabled={inFlight}");
  });

  test("the points screen's cancel button is gated on inFlight", () => {
    const tag = openingTagAround(SOURCES["PointsFlow.tsx"], "styles.cancelButton");
    expect(tag).toContain("disabled={inFlight}");
  });

  test("the points rewards chip is gated too, so no redeem starts on top of an add", () => {
    const tag = openingTagAround(SOURCES["PointsFlow.tsx"], "styles.chip, inFlight");
    expect(tag).toContain("disabled={inFlight}");
  });

  test("a locked control is dimmed, not hidden", () => {
    // A control that vanishes mid-request rearranges the screen under the
    // employee's thumb.
    for (const file of FLOWS) {
      expect(SOURCES[file]).toContain("lockedExit");
    }
  });
});

describe("a replayed answer is a success, not a second celebration", () => {
  // The customer was credited by the request this one repeats. That request
  // already ran the banner, the push and the haptics; `reward_earned` comes
  // back false precisely so a replay cannot announce a reward twice.

  test.each(FLOWS)("%s branches on the replay flag", (file) => {
    expect(SOURCES[file]).toContain("result.replayed");
  });

  test("the stamp flow's replay path taps once and never celebrates", () => {
    const replay = blockAfter(SOURCES["StampFlow.tsx"], "if (result.replayed) {");
    expect(replay).toContain("setAlreadyCounted(true)");
    expect(replay).toContain("acknowledge()");
    expect(replay).not.toContain("celebrate(");
  });

  test("the points flow's replay path taps once and skips the reward beat", () => {
    const replay = blockAfter(SOURCES["PointsFlow.tsx"], "if (result.replayed) {");
    expect(replay).toContain("setAlreadyCounted(true)");
    expect(replay).toContain("acknowledge()");
    expect(replay).not.toContain("ImpactFeedbackStyle.Heavy");
  });

  test.each(FLOWS)("%s gives the confirmed success its own title", (file) => {
    expect(SOURCES[file]).toContain("alreadyCounted");
  });
});

describe("the reconcile reads, and only reads", () => {
  // One fetch, then a human decides. An automatic re-send of a write nobody
  // can account for is exactly the double credit this stage exists to prevent.

  test.each(FLOWS)("%s reconciles with a single customer read", (file) => {
    const body = blockAfter(SOURCES[file], "async function reconcile()");
    expect(body.match(/getCustomer\(/g)).toHaveLength(1);
  });

  test.each(FLOWS)("%s never re-sends the mutation from the reconcile", (file) => {
    const body = blockAfter(SOURCES[file], "async function reconcile()");
    for (const mutation of ["addStamp(", "addPoints(", "redeemReward("]) {
      expect(body).not.toContain(mutation);
    }
  });
});
