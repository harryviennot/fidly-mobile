/**
 * Guards on the wiring the unit tests cannot reach.
 *
 * `client.ts`, `customers.ts` and `points.ts` all import `lib/supabase`, and
 * therefore react-native, whose Flow-typed entrypoint Bun cannot parse — the
 * same constraint the locale catalog tests explain at length. The behaviour
 * they carry is unit tested in `fetchCore.test.ts`, `scanRequests.test.ts` and
 * `scanErrors.test.ts`; what is left, and what this file pins, is that the three
 * counter mutations are actually PLUGGED INTO that tested core.
 *
 * A source scan is the honest tool here, exactly as in
 * `src/navigation-invariants.test.ts`: the bug this prevents is not inside a
 * function we could call, it is in which function a module chose to call.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..");

function read(relative: string): string {
  return readFileSync(join(SRC, relative), "utf8");
}

/** Source with `apiFetch(` masked, so a bare `fetch(` stands out. */
function withoutApiFetch(source: string): string {
  return source.replace(/apiFetch\(/g, "API_FETCH_CALL(");
}

const MUTATION_FILES = ["api/customers.ts", "api/points.ts"];

describe("the counter mutations go through the shared client", () => {
  test.each(MUTATION_FILES)("%s never calls fetch() directly", (file) => {
    // A bare fetch has no abort, no budget and no 401 refresh — which is the
    // frozen-till bug this stage exists to remove.
    expect(withoutApiFetch(read(file))).not.toMatch(/(?<![\w.])fetch\(/);
  });

  test("addStamp and redeemReward both ask for the mutation budget", () => {
    const source = read("api/customers.ts");
    expect(source.match(/MUTATION_TIMEOUT_MS/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test("addPoints asks for the mutation budget", () => {
    expect(read("api/points.ts")).toContain("MUTATION_TIMEOUT_MS");
  });

  test("the three of them accept a client key", () => {
    const customers = read("api/customers.ts");
    const points = read("api/points.ts");
    expect(customers).toContain("buildStampBody");
    expect(customers).toContain("buildRedeemBody");
    expect(points).toContain("buildPointsBody");
  });
});

describe("the request budgets", () => {
  const client = read("api/client.ts");

  test("a counter mutation gets 8s, shorter than the general 10s", () => {
    // Someone is standing at the till. The default budget is the one a
    // background read can afford; a scan cannot.
    expect(client).toMatch(/MUTATION_TIMEOUT_MS\s*=\s*8000/);
    expect(client).toMatch(/REQUEST_TIMEOUT_MS\s*=\s*10000/);
  });
});

describe("client keys are unguessable", () => {
  const source = read("lib/client-key.ts");

  test("the key comes from expo-crypto's randomUUID", () => {
    // Every member of the business can read a scan's client_key over realtime.
    // A predictable key would let one device's next key be claimed by someone
    // else, and the real scan would come back as a replay that credited
    // nothing (stage-5 security review).
    expect(source).toContain("expo-crypto");
    expect(source).toMatch(/randomUUID\(\)/);
  });

  test("nothing in the key path reaches for Math.random", () => {
    expect(source).not.toContain("Math.random");
  });
});

describe("the scanner speaks its own language", () => {
  test.each(["components/confirmation/StampFlow.tsx", "components/confirmation/PointsFlow.tsx"])(
    "%s never renders the server's message field",
    (file) => {
      // The backend answers a replay with "Already counted." — in English, to
      // a counter that may be French, Spanish or Polish. Every one of these
      // states has a localized key of its own.
      const source = read(file);
      for (const field of [
        "result.message",
        "success.message",
        "addResult.message",
        "redeemResult.message",
      ]) {
        expect(source).not.toContain(field);
      }
    }
  );
});
