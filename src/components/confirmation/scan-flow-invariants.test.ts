/**
 * Guards on the two confirmation flows and the route they live in, checked
 * against the source itself.
 *
 * These are rules about what a COMPONENT does, and this app has no component
 * test runner (per the workspace CLAUDE.md, the scanner's first one would be
 * jest-expo; standing one up is not this stage's job). The rules still have to
 * be pinned, because each is one deleted line away from a double credit at a
 * till, so they are checked the way `rewards-menu-props.test.ts` and
 * `src/navigation-invariants.test.ts` check theirs: by reading the source.
 *
 * Every assertion is scoped to the construct it names — one JSX tag, one
 * function body, one branch. A file-wide `toContain` is not a guard: an import
 * line, a `useState` declaration or a comment satisfies it, and the test then
 * reads as coverage while asserting nothing.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dir;
const ROUTE = join(HERE, "../../app/(protected)/stamp/[id].tsx");

const FLOWS = ["StampFlow.tsx", "PointsFlow.tsx"];

const SOURCES: Record<string, string> = {
  ...Object.fromEntries(FLOWS.map((f) => [f, readFileSync(join(HERE, f), "utf8")])),
  "RewardsMenu.tsx": readFileSync(join(HERE, "RewardsMenu.tsx"), "utf8"),
  route: readFileSync(ROUTE, "utf8"),
};

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

/**
 * One statement, from a marker to the `;` that ends it.
 *
 * For the things that are not brace blocks: a ternary assigned to a const, a
 * one-line subscription. Brace-matching those silently walks into the NEXT
 * block and asserts against the wrong code.
 */
function statementAfter(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`"${marker}" is not in the source any more`);
  const end = source.indexOf(";", start);
  if (end === -1) throw new Error(`unterminated statement after "${marker}"`);
  return source.slice(start, end + 1);
}

/** Everything between two markers, for a region that is neither. */
function sliceBetween(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  if (start === -1) throw new Error(`"${from}" is not in the source any more`);
  const end = source.indexOf(to, start);
  if (end === -1) throw new Error(`"${to}" does not follow "${from}"`);
  return source.slice(start, end + to.length);
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
  // Leaving mid-request unmounts the flow and with it the key ledger, so the
  // rescan that follows mints a NEW client key and a first request that lands
  // late credits twice. That is the one double credit the key cannot close, so
  // every exit has to be shut, not just the obvious ones.

  test.each([
    ["StampFlow.tsx", "styles.closeButton"],
    ["PointsFlow.tsx", "styles.cancelButton"],
    ["PointsFlow.tsx", "styles.chip, inFlight"],
  ])("%s: the control at %s is disabled AND dimmed", (file, marker) => {
    const tag = openingTagAround(SOURCES[file], marker);
    expect(tag).toContain("disabled={inFlight}");
    // Dimmed, not hidden: a control that vanishes mid-request rearranges the
    // screen under the employee's thumb.
    expect(tag).toContain("lockedExit");
  });

  test.each(FLOWS)("%s publishes the in-flight signal to the route", (file) => {
    // The buttons are this screen's business; the swipe and the hardware back
    // button are the route's, and it cannot see the request without this.
    const body = blockAfter(SOURCES[file], "useEffect(() => {\n    setLocked(inFlight);");
    expect(body).toContain("setLocked(inFlight)");
  });

  test("the route turns off the iOS swipe-back gesture while locked", () => {
    const tag = openingTagAround(SOURCES.route, "gestureEnabled");
    expect(tag).toMatch(/gestureEnabled:\s*!locked/);
  });

  test("the route swallows the Android hardware back button while locked", () => {
    const effect = sliceBetween(
      SOURCES.route,
      "const { locked } = useScanLock();",
      "}, [locked]);"
    );
    // Registered only while locked, and returning true is what marks the
    // press handled rather than letting it pop the screen.
    expect(effect).toContain("if (!locked) return;");
    expect(effect).toContain('BackHandler.addEventListener("hardwareBackPress"');
    expect(effect).toMatch(/=>\s*true/);
  });

  test("the rewards sheet cannot be dismissed out from under a redemption", () => {
    const tag = openingTagAround(SOURCES["RewardsMenu.tsx"], "<BottomSheet visible=");
    expect(tag).toContain("onClose={closeUnlessBusy}");
    const guard = blockAfter(SOURCES["RewardsMenu.tsx"], "const closeUnlessBusy =");
    expect(guard).toContain("if (!busy) onClose();");
  });
});

describe("a Retry belongs to the operation that failed", () => {
  // The defect this pins: a bare `retryable` boolean relabelled whichever CTA
  // was on screen, so a timed-out REDEEM turned "Add stamp" into "Retry" and
  // pressing it stamped the card instead of handing over the reward.

  test.each(FLOWS)("%s stores WHICH operation is retryable, not a boolean", (file) => {
    expect(SOURCES[file]).not.toContain("setRetryable");
    expect(SOURCES[file]).toMatch(/useState<RetryTarget \| null>\(null\)/);
  });

  test("the stamp CTA only ever offers to retry the stamp", () => {
    const decision = blockAfter(SOURCES["StampFlow.tsx"], "const retriesAdd = ownsRetry(");
    expect(decision).toContain('kind: "stamp"');
  });

  test("the points CTA only ever offers to retry the add", () => {
    const decision = blockAfter(SOURCES["PointsFlow.tsx"], "const retriesAdd = ownsRetry(");
    expect(decision).toContain('kind: "points"');
  });

  test("the generic redeem CTA claims only the DEFAULT redemption's retry", () => {
    // A named reward's retry lives on its own row; this button would send a
    // different request under the same word.
    const decision = blockAfter(
      SOURCES["StampFlow.tsx"],
      "const retriesDefaultRedeem = ownsRetry("
    );
    expect(decision).toMatch(/kind: "redeem", instanceId: null/);
  });

  test.each(FLOWS)("%s's add CTA reads its own ownership flag", (file) => {
    expect(SOURCES[file]).toContain("retriesAdd");
  });
});

describe("a replayed answer is a success, not a second celebration", () => {
  // The customer was credited by the request this one repeats. That request
  // already ran the banner, the push and the haptics; `reward_earned` comes
  // back false precisely so a replay cannot announce a reward twice.

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

  test("the stamp success title says so, and not in the server's words", () => {
    const title = statementAfter(SOURCES["StampFlow.tsx"], "const title = alreadyCounted");
    expect(title).toContain('t("success.alreadyCounted")');
  });

  test("the points success title says so", () => {
    expect(SOURCES["PointsFlow.tsx"]).toMatch(
      /alreadyCounted\s*\?\s*t\("success\.alreadyCounted"\)/
    );
    expect(SOURCES["PointsFlow.tsx"]).toMatch(
      /alreadyCounted\s*\?\s*t\("redeem\.alreadyRedeemed"\)/
    );
  });
});

describe("the reconciled success renders the fresh snapshot", () => {
  // The values on this screen are read back from the customer, never guessed
  // from what we hoped the request did.

  test.each(FLOWS)("%s builds its success from the re-read customer", (file) => {
    const credited = blockAfter(SOURCES[file], 'if (verdict === "credited" && fresh) {');
    expect(credited).toContain("reconciledResponse(fresh)");
    // The screen and the card below it must agree on who this customer is.
    expect(credited).toContain("setCustomer(fresh)");
    // ONE haptic: no per-stamp cascade, no reward beat.
    expect(credited).toContain("acknowledge()");
    expect(credited).not.toContain("celebrate(");
    // Settled: an identical tap after this is a second deliberate scan.
    expect(credited).toContain("releaseClientKey");
  });
});

describe("the reconcile reads, and only reads", () => {
  // One fetch, then a human decides. An automatic re-send of a write nobody
  // can account for is exactly the double credit this stage exists to prevent.

  test.each(FLOWS)("%s re-reads once per timeout, and never re-sends", (file) => {
    const timeout = blockAfter(SOURCES[file], 'if (failure === "timeout") {');
    expect(timeout.match(/reconcile\(\)/g)).toHaveLength(1);
    for (const mutation of ["addStamp(", "addPoints(", "redeemReward("]) {
      expect(timeout).not.toContain(mutation);
    }
  });
});

describe("the key survives everything that should not mint a new one", () => {
  test.each([
    ["StampFlow.tsx", "async function handleAddStamp("],
    ["StampFlow.tsx", "async function handleRedeemReward("],
    ["PointsFlow.tsx", "async function handleAdd("],
    ["PointsFlow.tsx", "async function handleRedeem("],
    ["PointsFlow.tsx", "async function handleRedeemHeld("],
  ])("%s: %s mints inside its try, so a failure is a banner", (file, handler) => {
    // randomUUID throws on older web builds. Minted outside the try, that
    // throw escaped the press handler: no spinner, no banner, a dead button.
    //
    // Scoped to THIS handler's body. Searching the file found `reconcile`'s
    // try first, which sits above every handler and made the comparison pass
    // whatever the handlers did.
    const body = blockAfter(SOURCES[file], handler);
    const tryStart = body.indexOf("try {");
    const claim = body.indexOf("claimClientKey(");
    expect(tryStart).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(tryStart);
  });

  test("the cap waiver mints a NEW key, because it sends a different body", () => {
    // cap_override: true is a different request. Replaying the blocked key
    // would re-run the truncated scan and void the manager's decision.
    const fingerprint = blockAfter(SOURCES["StampFlow.tsx"], "const fingerprint = scanFingerprint(");
    expect(fingerprint).toContain("capOverride: override");
  });

  test.each(FLOWS)("%s clears the in-flight phase however the request ends", (file) => {
    // Without this the employee is stranded on a locked screen with a spinner.
    const finallyBlock = blockAfter(SOURCES[file], "} finally {");
    expect(finallyBlock).toContain('setPhase("idle")');
  });

  test.each(FLOWS)("%s releases the key once the request settles", (file) => {
    // From then on an identical tap is a second deliberate scan, not a replay.
    expect(SOURCES[file]).toContain("releaseClientKey");
  });
});

describe("the load-error screen can be retried", () => {
  test("the dispatcher's secondary action re-runs the fetch", () => {
    const tag = openingTagAround(SOURCES.route, "secondary={{ label: tCommon(\"retry\")");
    expect(tag).toContain("onPress: loadCustomer");
  });
});
