/**
 * Catalog guards for `src/locales/`.
 *
 * i18next falls back to English for a key a locale is missing, so a hole here
 * does not crash — it ships a French-speaking barista an English button in the
 * middle of a Polish sentence, and nobody files a bug about it. These tests are
 * the only thing that notices.
 *
 * The locale list and the namespace list are both read out of `i18n.ts` rather
 * than re-listed here, so adding a language means editing that file and nothing
 * else. They are read as TEXT, not imported: `i18n.ts` pulls in
 * `expo-localization` and therefore `react-native`, whose Flow-typed entrypoint
 * Bun's test runner cannot parse. Parsing the two arrays out of the source keeps
 * the single source of truth without dragging the native runtime in.
 *
 * The Polish block at the bottom exists because Polish is the first language
 * this app ships where a present, correctly spelled string can still be wrong:
 * counts need four forms (1 pieczątka · 2 pieczątki · 5 pieczątek), and the
 * app resolves them through the `_one` / `_few` / `_many` / `_other` key
 * suffixes that `selectPluralForm` returns.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = import.meta.dir;
const SOURCE_LOCALE = "en";
const I18N_SOURCE = readFileSync(join(LOCALES_DIR, "i18n.ts"), "utf8");

/** `['en', 'fr', ...]` out of a TS array literal. */
function parseStringArray(label: string, pattern: RegExp): string[] {
  const match = I18N_SOURCE.match(pattern);
  if (!match) throw new Error(`could not find ${label} in src/locales/i18n.ts`);
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** Every language the app ships, straight from the constant `i18n.ts` exports. */
const SUPPORTED_LOCALES = parseStringArray(
  "SUPPORTED_LOCALES",
  /export const SUPPORTED_LOCALES\s*=\s*\[([^\]]*)\]/,
);

/** Every namespace registered with i18next. A folder i18next never loads is dead. */
const NAMESPACES = parseStringArray("the `ns:` init option", /\bns:\s*\[([^\]]*)\]/);

const OTHER_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== SOURCE_LOCALE);

/** The plural key suffixes `selectPluralForm` can return. */
const PLURAL_SUFFIXES = ["one", "few", "many", "other"] as const;

/** i18next interpolation: `{{count}}`. */
const INTERPOLATION = /\{\{\s*([\w.]+)\s*\}\}/g;

type Catalog = Record<string, string>;

function flatten(value: unknown, prefix = "", out: Catalog = {}): Catalog {
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out));
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

function catalogPath(locale: string, namespace: string) {
  return join(LOCALES_DIR, locale, `${namespace}.json`);
}

function load(locale: string, namespace: string): Catalog {
  return flatten(JSON.parse(readFileSync(catalogPath(locale, namespace), "utf8")));
}

function tokens(message: string): Set<string> {
  return new Set([...message.matchAll(INTERPOLATION)].map((m) => m[1]));
}

// ───────────────────────────── structure ─────────────────────────────

describe("the locale set and the namespace set line up with what is on disk", () => {
  test("SUPPORTED_LOCALES and the `ns:` list both parsed", () => {
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(1);
    expect(NAMESPACES.length).toBeGreaterThan(1);
  });

  test("every supported locale has a folder holding every namespace", () => {
    const missing: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      for (const namespace of NAMESPACES) {
        if (!existsSync(catalogPath(locale, namespace))) {
          missing.push(`src/locales/${locale}/${namespace}.json does not exist`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("every JSON file on disk is a namespace i18next actually loads", () => {
    const registered = new Set(NAMESPACES);
    const orphans = readdirSync(join(LOCALES_DIR, SOURCE_LOCALE))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .filter((n) => !registered.has(n))
      .map(
        (n) =>
          `src/locales/${SOURCE_LOCALE}/${n}.json is not in the \`ns:\` list in i18n.ts, ` +
          `so i18next never loads it`,
      );
    expect(orphans).toEqual([]);
  });
});

describe.each(NAMESPACES)("%s", (namespace) => {
  const source = load(SOURCE_LOCALE, namespace);
  const sourceKeys = Object.keys(source);

  describe.each(OTHER_LOCALES)("%s", (locale) => {
    const target = load(locale, namespace);

    test("has no missing keys (i18next silently serves English instead)", () => {
      const missing = sourceKeys
        .filter((key) => !(key in target))
        .map((key) => `src/locales/${locale}/${namespace}.json is missing "${key}"`);
      expect(missing).toEqual([]);
    });

    test("has no keys English does not have", () => {
      const extra = Object.keys(target)
        .filter((key) => !(key in source))
        .map((key) => `src/locales/${locale}/${namespace}.json has an extra key "${key}"`);
      expect(extra).toEqual([]);
    });

    test("interpolates exactly the values English interpolates", () => {
      const drift: string[] = [];
      for (const key of sourceKeys) {
        if (!(key in target)) continue;
        const expected = tokens(source[key]);
        const actual = tokens(target[key]);
        const missing = [...expected].filter((t) => !actual.has(t));
        const extra = [...actual].filter((t) => !expected.has(t));
        if (missing.length || extra.length) {
          drift.push(
            `src/locales/${locale}/${namespace}.json "${key}": ` +
              `missing {{${missing.join("}}, {{")}}} unexpected {{${extra.join("}}, {{")}}}`,
          );
        }
      }
      expect(drift).toEqual([]);
    });

    test("uses no em dashes", () => {
      const offenders = Object.entries(target)
        .filter(([, value]) => value.includes("—"))
        .map(
          ([key, value]) =>
            `src/locales/${locale}/${namespace}.json "${key}" contains an em dash: ${value.slice(0, 60)}`,
        );
      expect(offenders).toEqual([]);
    });
  });
});

// ───────────────────────────── Polish ─────────────────────────────

const POLISH_ENABLED = SUPPORTED_LOCALES.includes("pl");

describe("Polish plural suffixes", () => {
  test.skipIf(!POLISH_ENABLED)(
    "every counted key carries one/few/many/other in Polish",
    () => {
      const gaps: string[] = [];
      for (const namespace of NAMESPACES) {
        const source = load(SOURCE_LOCALE, namespace);
        const polish = load("pl", namespace);
        for (const key of Object.keys(source)) {
          if (!key.endsWith("_one")) continue;
          const stem = key.slice(0, -"_one".length);
          const missing = PLURAL_SUFFIXES.filter((s) => !(`${stem}_${s}` in polish));
          if (missing.length) {
            gaps.push(
              `src/locales/pl/${namespace}.json "${stem}" is missing ` +
                `${missing.map((s) => `${stem}_${s}`).join(", ")}. Polish needs ` +
                `one (1), few (2-4, 22-24), many (0, 5-21) and other (fractions) — ` +
                `see selectPluralForm in src/utils/plural.ts.`,
            );
          }
        }
      }
      expect(gaps).toEqual([]);
    },
  );

});

/**
 * Second-person singular past tense, which agrees with the reader's gender
 * (`Zapisałeś` / `Zapisałaś`). We never know the employee's gender.
 *
 * The lookahead is load-bearing. JavaScript's `\b` is defined over
 * `[A-Za-z0-9_]`, so `ś` reads as a NON-word character and `/ł[ea]ś\b/` fires in
 * the middle of `właśnie` and `właściciel`. Anchoring on "not followed by any
 * Unicode letter" is what makes the guard usable; the self-test pins both edges.
 */
const GENDERED_PAST = /ł[ea]ś(?!\p{L})/u;

describe("Polish never addresses the employee in the past tense", () => {
  test.skipIf(!POLISH_ENABLED)("no gendered past tense in any namespace", () => {
    const offenders: string[] = [];
    for (const namespace of NAMESPACES) {
      for (const [key, value] of Object.entries(load("pl", namespace))) {
        if (GENDERED_PAST.test(value)) {
          offenders.push(
            `src/locales/pl/${namespace}.json "${key}" uses a gendered past tense ` +
              `(use an impersonal form like "Zapisano"): ${value.slice(0, 80)}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test.each(["Zapisałeś zmiany", "Dodałaś pieczątkę", "Zeskanowałeś."])(
    "the guard flags %p",
    (text) => {
      expect(GENDERED_PAST.test(text)).toBe(true);
    },
  );

  test.each([
    "właśnie", // the trap: "łaś" sits mid-word
    "Właśnie dodano pieczątkę",
    "właściciel",
    "właściwy lokal",
    "Zapisano",
  ])("the guard does not flag %p", (text) => {
    expect(GENDERED_PAST.test(text)).toBe(false);
  });
});
