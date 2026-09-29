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
 *
 * Every assertion below is scoped to the construct it is about — a function's
 * own body, a single import statement. An earlier cut of this file counted
 * occurrences across whole files, which meant the import line satisfied the
 * assertion and the test could not fail on the thing it named.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..");

function read(relative: string): string {
  return readFileSync(join(SRC, relative), "utf8");
}

/**
 * The body of a named function, brace-matched.
 *
 * Throws when the function is gone, which is itself a guard: renaming or
 * deleting it fails the test rather than vacuously passing it.
 */
function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`"${signature}" is not in the source any more`);
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unterminated body for "${signature}"`);
}

/** Source with `apiFetch(` masked, so a bare `fetch(` stands out. */
function withoutApiFetch(source: string): string {
  return source.replace(/apiFetch\(/g, "API_FETCH_CALL(");
}

const MUTATIONS: [string, string, string][] = [
  ["api/customers.ts", "export async function addStamp(", "buildStampBody"],
  ["api/customers.ts", "export async function redeemReward(", "buildRedeemBody"],
  ["api/points.ts", "export async function addPoints(", "buildPointsBody"],
];

describe("the counter mutations go through the shared client", () => {
  test.each(["api/customers.ts", "api/points.ts"])(
    "%s never calls fetch() directly",
    (file) => {
      // A bare fetch has no abort, no budget and no 401 refresh — which is the
      // frozen-till bug this stage exists to remove.
      expect(withoutApiFetch(read(file))).not.toMatch(/(?<![\w.])fetch\(/);
    }
  );

  test.each(MUTATIONS)("%s: %s spends the mutation budget", (file, signature) => {
    // Scoped to this function's own body: the import line at the top of the
    // file must not be what satisfies this.
    expect(functionBody(read(file), signature)).toContain("MUTATION_TIMEOUT_MS");
  });

  test.each(MUTATIONS)("%s: %s builds its body through the tested builder", (
    file,
    signature,
    builder
  ) => {
    expect(functionBody(read(file), signature)).toContain(builder);
  });

  test.each(MUTATIONS)("%s: %s puts the client key on the wire", (file, signature) => {
    expect(functionBody(read(file), signature)).toContain("clientKey");
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

  test("apiFetch actually honours the override it is handed", () => {
    // The single line that turns the 8s constant into a real budget. Without
    // it every mutation silently returns to the 10s read budget and nothing
    // else in the suite notices.
    const body = functionBody(client, "export async function apiFetch<T>(");
    expect(body).toMatch(/timeoutMs:\s*config\.timeoutMs\s*\?\?\s*REQUEST_TIMEOUT_MS/);
  });

  test("the reconcile read is bounded by the mutation budget too", () => {
    // It runs AFTER a scan has already spent its 8s. On the read budget the
    // till is held for the sum of both while an employee waits.
    for (const flow of ["StampFlow", "PointsFlow"]) {
      const source = read(`components/confirmation/${flow}.tsx`);
      const body = functionBody(source, "async function reconcile()");
      expect(body).toContain("MUTATION_TIMEOUT_MS");
    }
  });
});

describe("client keys are unguessable", () => {
  const source = read("lib/client-key.ts");

  test("the key generator is imported from expo-crypto", () => {
    // Scoped to an import STATEMENT: the docstring above it mentions
    // expo-crypto too, and a plain file-wide search is satisfied by prose.
    expect(source).toMatch(/^import .* from "expo-crypto";$/m);
  });

  test("it prefers randomUUID and still answers when that is missing", () => {
    // randomUUID is secure-context-gated on the web build and absent on older
    // browsers, where reaching for it throws. Without the fallback the press
    // handler died before any state was set: no spinner, no banner, a till
    // that had simply stopped.
    const body = functionBody(source, "export function mintClientKey()");
    expect(body).toContain("randomUUID");
    expect(body).toMatch(/uuidFromRandomBytes\(\)/);
  });

  test("the fallback is the CSPRNG, not the ordinary random generator", () => {
    const fallback = functionBody(source, "function uuidFromRandomBytes()");
    expect(fallback).toContain("Crypto.getRandomValues");
    expect(source).not.toContain("Math.random");
  });
});

describe("ids stay out of the logs", () => {
  test("a 401 logs the route, never the business and enrollment it names", () => {
    // Breadcrumbs travel to Sentry. `/stamps/{business}/{enrollment}` names a
    // business and one customer's enrollment.
    const body = functionBody(read("api/fetchCore.ts"), "export async function requestWithAuthRetry<T>(");
    const logs = body.match(/console\.(log|warn)\([^)]*\)/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    const leaking = logs.filter((line) => /\$\{endpoint\}/.test(line));
    expect(leaking).toEqual([]);
  });
});
