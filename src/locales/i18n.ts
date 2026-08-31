import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

// English translations
import enCommon from './en/common.json';
import enLogin from './en/login.json';
import enBusinesses from './en/businesses.json';
import enLobby from './en/lobby.json';
import enScanner from './en/scanner.json';
import enStamp from './en/stamp.json';
import enLocation from './en/location.json';
import enPoints from './en/points.json';
import enUpdate from './en/update.json';

// French translations
import frCommon from './fr/common.json';
import frLogin from './fr/login.json';
import frBusinesses from './fr/businesses.json';
import frLobby from './fr/lobby.json';
import frScanner from './fr/scanner.json';
import frStamp from './fr/stamp.json';
import frLocation from './fr/location.json';
import frPoints from './fr/points.json';
import frUpdate from './fr/update.json';

// Spanish translations
import esCommon from './es/common.json';
import esLogin from './es/login.json';
import esBusinesses from './es/businesses.json';
import esLobby from './es/lobby.json';
import esScanner from './es/scanner.json';
import esStamp from './es/stamp.json';
import esLocation from './es/location.json';
import esPoints from './es/points.json';
import esUpdate from './es/update.json';

// Polish translations
import plCommon from './pl/common.json';
import plLogin from './pl/login.json';
import plBusinesses from './pl/businesses.json';
import plLobby from './pl/lobby.json';
import plScanner from './pl/scanner.json';
import plStamp from './pl/stamp.json';
import plLocation from './pl/location.json';
import plPoints from './pl/points.json';
import plUpdate from './pl/update.json';

const resources = {
  en: {
    common: enCommon,
    login: enLogin,
    businesses: enBusinesses,
    lobby: enLobby,
    scanner: enScanner,
    stamp: enStamp,
    location: enLocation,
    points: enPoints,
    update: enUpdate,
  },
  fr: {
    common: frCommon,
    login: frLogin,
    businesses: frBusinesses,
    lobby: frLobby,
    scanner: frScanner,
    stamp: frStamp,
    location: frLocation,
    points: frPoints,
    update: frUpdate,
  },
  es: {
    common: esCommon,
    login: esLogin,
    businesses: esBusinesses,
    lobby: esLobby,
    scanner: esScanner,
    stamp: esStamp,
    location: esLocation,
    points: esPoints,
    update: esUpdate,
  },
  pl: {
    common: plCommon,
    login: plLogin,
    businesses: plBusinesses,
    lobby: plLobby,
    scanner: plScanner,
    stamp: plStamp,
    location: plLocation,
    points: plPoints,
    update: plUpdate,
  },
};

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

// Get device locale safely. `languageCode` is already the base code ('pl'), but
// normalise anyway so a platform that hands back 'pl-PL' still matches.
export function getDeviceLocale(): SupportedLocale {
  try {
    const locales = getLocales();
    return resolveSupportedLocale(locales?.[0]?.languageCode);
  } catch {
    return 'en';
  }
}

// The employee's saved choice (if any) is applied after boot, once storage has
// been read: see `restoreStoredLanguage` in lib/app-language.
const initialLocale = getDeviceLocale();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'login', 'businesses', 'lobby', 'scanner', 'stamp', 'location', 'points', 'update'],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // For React Native compatibility
  },
});

export default i18n;
