import { describe, expect, it } from "bun:test";
import { ESLint } from "eslint";

// The lint rule in eslint.config.js is the guard that keeps every sign-out on
// this device only; these cases prove it fires.
const eslint = new ESLint();

async function flagged(code: string): Promise<boolean> {
  const [result] = await eslint.lintText(code, { filePath: "sign-out-probe.ts" });
  return result.messages.some((m) => m.ruleId === "no-restricted-syntax");
}

describe("the sign-out scope lint rule", () => {
  it.each([
    "supabase.auth.signOut();",
    "supabase.auth.signOut({});",
    'supabase.auth.signOut({ scope: "global" });',
    'supabase.auth.signOut({ scope: "others" });',
    "supabase.auth.signOut(options);",
    "createClient().auth.signOut();",
  ])("rejects %s", async (code) => {
    expect(await flagged(code)).toBe(true);
  });

  it.each(['supabase.auth.signOut({ scope: "local" });', 'createClient().auth.signOut({ scope: "local" });'])(
    "accepts %s",
    async (code) => {
      expect(await flagged(code)).toBe(false);
    }
  );
});
