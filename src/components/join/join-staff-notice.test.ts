/**
 * Every way into a business ends on JoinCodeFlow's confirmation, and that
 * confirmation tells the employee their scans carry their name before they
 * join. Checked against the source, as `scan-flow-invariants.test.ts` does,
 * because this app has no component test runner.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dir;
const read = (path: string) => readFileSync(join(HERE, path), "utf8");

const FLOW = read("JoinCodeFlow.tsx");
const NOTICE_CALL = 't("confirmStaffNotice", { business: preview.business_name })';

/** The branch that renders the confirmation, up to the code-entry screen that follows it. */
function confirmBranch(source: string): string {
  const start = source.indexOf('if ((phase === "confirm" || phase === "joining") && preview) {');
  const codeScreen = source.indexOf("<AuthScreen", source.indexOf("<AuthScreen", start) + 1);
  expect(start).toBeGreaterThan(-1);
  expect(codeScreen).toBeGreaterThan(start);
  return source.slice(start, codeScreen);
}

describe("the staff notice on the join confirmation", () => {
  test("the confirmation names the business in the notice, inside the screen body", () => {
    const branch = confirmBranch(FLOW);
    const body = branch.slice(branch.indexOf("body={"));

    expect(body).toContain(NOTICE_CALL);
  });

  test("the code-entry screen does not show it: there is no business to name yet", () => {
    const afterConfirm = FLOW.slice(FLOW.indexOf(confirmBranch(FLOW)) + confirmBranch(FLOW).length);

    expect(afterConfirm).not.toContain("confirmStaffNotice");
  });

  test("an emailed link and the join-another-shop sheet both land on that confirmation", () => {
    expect(read("JoinBusinessSheet.tsx")).toMatch(/router\.push\(`\/join\/\$\{normalized\}`\)/);
    expect(read("../../app/join/[code].tsx")).toMatch(/<JoinScreen initialCode=/);
    expect(read("JoinScreen.tsx")).toMatch(/<JoinCodeFlow\b/);
  });

  test.each(["en", "fr", "es", "pl"])("the %s catalog has the notice, naming the business", (locale) => {
    const catalog = JSON.parse(readFileSync(join(HERE, `../../locales/${locale}/join.json`), "utf8"));

    expect(typeof catalog.confirmStaffNotice).toBe("string");
    expect(catalog.confirmStaffNotice).toContain("{{business}}");
  });
});
