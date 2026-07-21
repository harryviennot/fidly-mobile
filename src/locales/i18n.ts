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

const supportedLocales = ['en', 'fr', 'es'];
const deviceLocale = getDeviceLocale();
const initialLocale = supportedLocales.includes(deviceLocale) ? deviceLocale : 'en';

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
