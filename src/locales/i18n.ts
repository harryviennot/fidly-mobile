import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import {
  SUPPORTED_LOCALES,
  isSupportedLocale,
  resolveSupportedLocale,
  type SupportedLocale,
} from './supported';

// English translations
import enCommon from './en/common.json';
import enLogin from './en/login.json';
import enBusinesses from './en/businesses.json';
import enLobby from './en/lobby.json';
import enScanner from './en/scanner.json';
import enStamp from './en/stamp.json';
import enJoin from './en/join.json';
import enOnboarding from './en/onboarding.json';
import enLocation from './en/location.json';
import enPoints from './en/points.json';
import enUpdate from './en/update.json';
import enWelcome from './en/welcome.json';

// French translations
import frCommon from './fr/common.json';
import frLogin from './fr/login.json';
import frBusinesses from './fr/businesses.json';
import frLobby from './fr/lobby.json';
import frScanner from './fr/scanner.json';
import frStamp from './fr/stamp.json';
import frJoin from './fr/join.json';
import frOnboarding from './fr/onboarding.json';
import frLocation from './fr/location.json';
import frPoints from './fr/points.json';
import frUpdate from './fr/update.json';
import frWelcome from './fr/welcome.json';

// Spanish translations
import esCommon from './es/common.json';
import esLogin from './es/login.json';
import esBusinesses from './es/businesses.json';
import esLobby from './es/lobby.json';
import esScanner from './es/scanner.json';
import esStamp from './es/stamp.json';
import esJoin from './es/join.json';
import esOnboarding from './es/onboarding.json';
import esLocation from './es/location.json';
import esPoints from './es/points.json';
import esUpdate from './es/update.json';
import esWelcome from './es/welcome.json';

// Polish translations
import plCommon from './pl/common.json';
import plLogin from './pl/login.json';
import plBusinesses from './pl/businesses.json';
import plLobby from './pl/lobby.json';
import plScanner from './pl/scanner.json';
import plStamp from './pl/stamp.json';
import plJoin from './pl/join.json';
import plOnboarding from './pl/onboarding.json';
import plLocation from './pl/location.json';
import plPoints from './pl/points.json';
import plUpdate from './pl/update.json';
import plWelcome from './pl/welcome.json';

const resources = {
  en: {
    common: enCommon,
    login: enLogin,
    businesses: enBusinesses,
    lobby: enLobby,
    scanner: enScanner,
    stamp: enStamp,
    join: enJoin,
    onboarding: enOnboarding,
    location: enLocation,
    points: enPoints,
    update: enUpdate,
    welcome: enWelcome,
  },
  fr: {
    common: frCommon,
    login: frLogin,
    businesses: frBusinesses,
    lobby: frLobby,
    scanner: frScanner,
    stamp: frStamp,
    join: frJoin,
    onboarding: frOnboarding,
    location: frLocation,
    points: frPoints,
    update: frUpdate,
    welcome: frWelcome,
  },
  es: {
    common: esCommon,
    login: esLogin,
    businesses: esBusinesses,
    lobby: esLobby,
    scanner: esScanner,
    stamp: esStamp,
    join: esJoin,
    onboarding: esOnboarding,
    location: esLocation,
    points: esPoints,
    update: esUpdate,
    welcome: esWelcome,
  },
  pl: {
    common: plCommon,
    login: plLogin,
    businesses: plBusinesses,
    lobby: plLobby,
    scanner: plScanner,
    stamp: plStamp,
    join: plJoin,
    onboarding: plOnboarding,
    location: plLocation,
    points: plPoints,
    update: plUpdate,
    welcome: plWelcome,
  },
};

// The language set itself lives in a react-native-free module so unit tests and
// pure helpers can import it; re-exported here so existing callers are unchanged.
export { SUPPORTED_LOCALES, isSupportedLocale, resolveSupportedLocale };
export type { SupportedLocale };

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
  ns: ['common', 'login', 'businesses', 'lobby', 'scanner', 'stamp', 'location', 'points', 'update', 'join', 'onboarding', 'welcome'],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // For React Native compatibility
  },
});

export default i18n;
