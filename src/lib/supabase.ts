import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Check if localStorage is available (not available in SSR)
const isLocalStorageAvailable = () => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

// SecureStore has a 2048 byte limit - chunk large values to avoid warnings
const CHUNK_SIZE = 1800;

async function getChunkedItem(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${key}_count`);
  if (!countStr) {
    // Try single item (backwards compatibility)
    return SecureStore.getItemAsync(key);
  }
  const count = parseInt(countStr, 10);
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
    if (!chunk) return null;
    chunks.push(chunk);
  }
  return chunks.join("");
}

async function setChunkedItem(key: string, value: string): Promise<void> {
  await removeChunkedItem(key);
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${key}_count`, chunks.length.toString());
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_${i}`, chunk)));
}

async function removeChunkedItem(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}_count`);
  await SecureStore.deleteItemAsync(key);
  if (countStr) {
    const count = parseInt(countStr, 10);
    await SecureStore.deleteItemAsync(`${key}_count`);
    await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}_${i}`)));
  }
}

// Custom storage adapter using SecureStore for native, localStorage for web
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web" && isLocalStorageAvailable()) {
      return localStorage.getItem(key);
    }
    if (Platform.OS !== "web") {
      return getChunkedItem(key);
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web" && isLocalStorageAvailable()) {
      localStorage.setItem(key, value);
      return;
    }
    if (Platform.OS !== "web") {
      await setChunkedItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web" && isLocalStorageAvailable()) {
      localStorage.removeItem(key);
      return;
    }
    if (Platform.OS !== "web") {
      await removeChunkedItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to get auth headers for API requests
export async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(session?.access_token && {
      Authorization: `Bearer ${session.access_token}`,
    }),
  };
}
