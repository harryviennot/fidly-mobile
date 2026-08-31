import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, {
  getDeviceLocale,
  isSupportedLocale,
  type SupportedLocale,
} from "@/locales/i18n";

/**
 * Manual language override.
 *
 * The app starts in the device language, which is right for almost everyone.
 * It is wrong for the shop where the phone belongs to the business and the
 * staff do not read the owner's language, so the lobby lets them pick. The
 * choice is stored per device and survives restarts; clearing it hands control
 * back to the device.
 */
const STORAGE_KEY = "app_language";

async function readStoredValue(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(STORAGE_KEY);
  }
  return AsyncStorage.getItem(STORAGE_KEY);
}

/** The saved choice, or null when the app is following the device. */
export async function getStoredLanguage(): Promise<SupportedLocale | null> {
  try {
    const raw = await readStoredValue();
    return isSupportedLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Apply the saved choice at startup. No-op when nothing is saved, so the
 * device language i18n booted with stays in place.
 */
export async function restoreStoredLanguage(): Promise<void> {
  const stored = await getStoredLanguage();
  if (!stored || stored === i18n.language) return;
  try {
    await i18n.changeLanguage(stored);
  } catch {
    // Never block the app on a language switch; the device language still works.
  }
}

/**
 * Switch the app language now and remember it. Pass null to forget the choice
 * and go back to following the device.
 */
export async function setAppLanguage(locale: SupportedLocale | null): Promise<void> {
  const next = locale ?? getDeviceLocale();
  try {
    if (Platform.OS === "web") {
      if (locale) localStorage.setItem(STORAGE_KEY, locale);
      else localStorage.removeItem(STORAGE_KEY);
    } else if (locale) {
      await AsyncStorage.setItem(STORAGE_KEY, locale);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // best-effort: the switch below still applies for this session
  }
  if (next !== i18n.language) {
    await i18n.changeLanguage(next);
  }
}
