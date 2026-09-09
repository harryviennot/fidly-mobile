import { resolveSupportedLocale } from "@/locales/supported";

/**
 * The public site. Business signup starts here, NOT on app.stampeo.app: the
 * dashboard has no entry for someone who does not have an account yet.
 */
export const SHOWCASE_BASE_URL = "https://stampeo.app";

/**
 * Where an owner goes to create a business. Served in the language they are
 * already reading in the app, so the handoff to the web does not also change
 * language on them.
 */
export function buildOnboardingUrl(language: string | null | undefined): string {
  return `${SHOWCASE_BASE_URL}/${resolveSupportedLocale(language)}/onboarding`;
}
