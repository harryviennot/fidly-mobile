/**
 * The held-rewards list must draw the origin tag the helper decides on.
 *
 * `heldRewardTag` is pure and tested on its own, but the list is a React Native
 * component Bun cannot mount, so nothing else notices if a row stops rendering
 * the tag it was given. A source check is the honest guard.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(import.meta.dir, "HeldRewardsList.tsx"), "utf8");

describe("HeldRewardsList", () => {
  test("renders the origin tag of each row from the shared helper", () => {
    expect(SOURCE).toContain("heldRewardTag(reward)");
    expect(SOURCE).toMatch(/tag\s*&&/);
  });
});
