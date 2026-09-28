import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `useLockedDim` returns a Reanimated style. On a plain (non-animated) component
// React Native freezes it in dev and Reanimated crashes the screen updating it;
// in release the control silently never dims. It must only reach an animated host.
const FILES = ["StampFlow.tsx", "PointsFlow.tsx"];

function dimVariables(source: string): string[] {
  return [...source.matchAll(/const (\w+) = useLockedDim\(/g)].map((m) => m[1]);
}

function plainHostsUsing(source: string, variable: string): number {
  const opening = /<(TouchableOpacity|TouchableHighlight|View|Pressable)\b[^>]*>/gs;
  return [...source.matchAll(opening)].filter((m) =>
    new RegExp(`style=\\{[^}]*\\b${variable}\\b`).test(m[0])
  ).length;
}

describe("the locked dim only ever reaches an animated component", () => {
  it.each(FILES)("%s", (file) => {
    const source = readFileSync(join(import.meta.dir, file), "utf8");
    const variables = dimVariables(source);
    expect(variables.length).toBeGreaterThan(0);
    for (const variable of variables) {
      expect({ variable, plainHosts: plainHostsUsing(source, variable) }).toEqual({
        variable,
        plainHosts: 0,
      });
    }
  });
});
