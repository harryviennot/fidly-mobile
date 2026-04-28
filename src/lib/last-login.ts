import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LastLoginMethod = "google" | "apple" | "email";

export interface LastLogin {
  method: LastLoginMethod;
  email?: string;
  at: string;
}

const STORAGE_KEY = "stampeo_last_login";

function isMethod(value: unknown): value is LastLoginMethod {
  return value === "google" || value === "apple" || value === "email";
}

export async function readLastLogin(): Promise<LastLogin | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
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

export async function writeLastLogin(
  method: LastLoginMethod,
  email?: string
): Promise<void> {
  try {
    const value = JSON.stringify({ method, email, at: new Date().toISOString() });
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch {
    // best-effort: don't block sign-in on storage failure
  }
}

export function useLastLogin(): LastLogin | null {
  const [value, setValue] = useState<LastLogin | null>(null);
  useEffect(() => {
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
