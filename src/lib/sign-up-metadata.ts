import { resolveSupportedLocale } from "@/locales/supported";

/** `user_metadata` for a new account; `locale` picks the sign-up email's language (the app's, not the device's). */
export function signUpMetadata(name: string, uiLanguage: string | null | undefined) {
  return { name, locale: resolveSupportedLocale(uiLanguage) };
}
