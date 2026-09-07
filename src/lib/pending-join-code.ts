import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  isPendingCodeFresh,
  isValidJoinCode,
  normalizeJoinCode,
} from "./join-code";

/**
 * Holds the join code across the sign-in detour.
 *
 * The code-first flow asks for the code before the account, so the code has to
 * survive an OAuth round trip. On native that round trip goes out to Google and
 * comes back through the `stampeo-scanner://auth/callback` deep link, which can
 * cold-launch the app: component state does not survive it, storage does.
 *
 * Short TTL on purpose. A stale code sitting in storage would silently pull
 * someone into a shop they tried to join days ago.
 */

const KEY = "pending_join_code";

interface StoredCode {
  code: string;
  savedAt: number;
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(KEY) ?? null;
  return AsyncStorage.getItem(KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(KEY, value);
    return;
  }
  await AsyncStorage.setItem(KEY, value);
}

export async function savePendingJoinCode(code: string): Promise<void> {
  const normalized = normalizeJoinCode(code);
  if (!isValidJoinCode(normalized)) return;
  const payload: StoredCode = { code: normalized, savedAt: Date.now() };
  try {
    await writeRaw(JSON.stringify(payload));
  } catch {
    // Storage is a convenience here; the user can always retype the code.
  }
}

export async function readPendingJoinCode(): Promise<string | null> {
  try {
    const raw = await readRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCode;
    if (!isValidJoinCode(parsed.code)) return null;
    if (!isPendingCodeFresh(parsed.savedAt, Date.now())) {
      await clearPendingJoinCode();
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export async function clearPendingJoinCode(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(KEY);
      return;
    }
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing actionable.
  }
}
