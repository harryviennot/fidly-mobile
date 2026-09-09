/**
 * The language set, kept free of any React Native import.
 *
 * `i18n.ts` pulls in `expo-localization` and therefore `react-native`, whose
 * Flow-typed entrypoint Bun's test runner cannot parse. Anything that needs to
 * know which languages exist — a unit test, or a pure helper like
 * `lib/onboarding-url` — imports this file instead and stays runnable under
 * `bun test`. `i18n.ts` re-exports all of it, so callers already inside the app
 * need not care which file it came from.
 */

/** Every language the app ships. The single source of truth: derive, never re-list. */
export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'pl'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Base language code of a tag: 'pl-PL' and 'pl_PL' both become 'pl'. */
function baseLanguage(value: string | null | undefined): string {
  return (value ?? '').split(/[-_]/)[0].toLowerCase();
}

/**
 * The locale we should serve for a language tag, English when we ship nothing
 * closer. Matches on the base code, so a pl-PL device gets Polish.
 */
export function resolveSupportedLocale(value: string | null | undefined): SupportedLocale {
  const base = baseLanguage(value);
  return isSupportedLocale(base) ? base : 'en';
}
