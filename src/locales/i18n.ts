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

// French translations
import frCommon from './fr/common.json';
import frLogin from './fr/login.json';
import frBusinesses from './fr/businesses.json';
import frLobby from './fr/lobby.json';
import frScanner from './fr/scanner.json';
import frStamp from './fr/stamp.json';

const resources = {
  en: {
    common: enCommon,
    login: enLogin,
    businesses: enBusinesses,
    lobby: enLobby,
    scanner: enScanner,
    stamp: enStamp,
  },
  fr: {
    common: frCommon,
    login: frLogin,
    businesses: frBusinesses,
    lobby: frLobby,
    scanner: frScanner,
    stamp: frStamp,
  },
};

// Get device locale safely
function getDeviceLocale(): string {
  try {
    const locales = getLocales();
    return locales?.[0]?.languageCode ?? 'en';
  } catch {
    return 'en';
  }
}

const supportedLocales = ['en', 'fr'];
const deviceLocale = getDeviceLocale();
const initialLocale = supportedLocales.includes(deviceLocale) ? deviceLocale : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'login', 'businesses', 'lobby', 'scanner', 'stamp'],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // For React Native compatibility
  },
});

export default i18n;
