/**
 * Plural-category selection, done by hand.
 *
 * i18next resolves plural suffixes through `Intl.PluralRules`, which Hermes
 * does not reliably ship, so this app has always picked its own wording at the
 * call site. A binary "1 or not 1" ternary was enough for en/fr/es, but Polish
 * cannot be written that way: 1 pieczątka, 2 pieczątki, 5 pieczątek. So the
 * CLDR categories are spelled out here instead, with no dependency on `Intl`.
 *
 * Call sites use the returned form as the i18next key suffix, e.g.
 * `t(`quantity.pending_${selectPluralForm(i18n.language, n)}`, { count: n })`.
 */

/** The CLDR plural categories this app uses as key suffixes. */
export type PluralForm = "one" | "few" | "many" | "other";

/**
 * Polish (CLDR):
 * - `one`  1
 * - `few`  ends in 2-4, except 12-14 (2, 3, 4, 22, 23, 24, 102…)
 * - `many` everything else whole (0, 5-21, 25-31, 101…)
 * - `other` fractions (1,5 pieczątki)
 */
function polishForm(count: number): PluralForm {
  // Fractions are the `other` category; NaN/Infinity land here too rather than
  // falling through to a wrong noun form.
  if (!Number.isInteger(count)) return "other";
  const n = Math.abs(count);
  if (n === 1) return "one";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "few";
  return "many";
}

/**
 * The plural form `count` takes in `locale`.
 *
 * Accepts a full language tag (`pl-PL`) or a base code (`pl`). Every locale
 * other than Polish keeps the app's existing behaviour: singular at exactly 1,
 * plural otherwise.
 */
export function selectPluralForm(locale: string | null | undefined, count: number): PluralForm {
  const language = (locale ?? "").split(/[-_]/)[0].toLowerCase();
  if (language === "pl") return polishForm(count);
  return count === 1 ? "one" : "other";
}
