import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LastLoginMethod = "google" | "apple" | "email";

export interface LastLogin {
  method: LastLoginMethod;
  email?: string;
  at: string;
}

// Shared with web/ + showcase/ via cookie on EXPO_PUBLIC_COOKIE_DOMAIN.
// Same key + JSON shape as web/src/lib/last-login.ts.
const STORAGE_KEY = "stampeo_last_login";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isMethod(value: unknown): value is LastLoginMethod {
  return value === "google" || value === "apple" || value === "email";
}

function parseValue(raw: string): LastLogin | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LastLogin>;
    if (!isMethod(parsed.method)) return null;
    return {
      method: parsed.method,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      at: typeof parsed.at === "string" ? parsed.at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function readCookieValue(): LastLogin | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STORAGE_KEY}=`));
  if (!match) return null;
  const raw = match.slice(STORAGE_KEY.length + 1);
  try {
    return parseValue(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function writeCookieValue(value: LastLogin): void {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(JSON.stringify(value));
  const cookieDomain = process.env.EXPO_PUBLIC_COOKIE_DOMAIN;
  let cookie = `${STORAGE_KEY}=${encoded}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`;
  if (cookieDomain) cookie += `; Domain=${cookieDomain}`;
  if (process.env.NODE_ENV === "production") cookie += "; Secure";
  document.cookie = cookie;
}

export async function readLastLogin(): Promise<LastLogin | null> {
  if (Platform.OS === "web") {
    return readCookieValue();
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseValue(raw);
  } catch {
    return null;
  }
}

export async function writeLastLogin(
  method: LastLoginMethod,
  email?: string
): Promise<void> {
  const value: LastLogin = { method, email, at: new Date().toISOString() };
  if (Platform.OS === "web") {
    writeCookieValue(value);
    return;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // best-effort: don't block sign-in on storage failure
  }
}

export function useLastLogin(): LastLogin | null {
  // On web, read the cookie synchronously in the initializer so the
  // AuthMethodChooser badge doesn't flash empty on first render.
  const [value, setValue] = useState<LastLogin | null>(() =>
    Platform.OS === "web" ? readCookieValue() : null
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    readLastLogin().then((v) => {
      if (!cancelled) setValue(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}
