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

// Custom storage adapter using SecureStore for native, localStorage for web
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web" && isLocalStorageAvailable()) {
      return localStorage.getItem(key);
    }
    if (Platform.OS !== "web") {
      return SecureStore.getItemAsync(key);
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web" && isLocalStorageAvailable()) {
      localStorage.setItem(key, value);
      return;
    }
    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web" && isLocalStorageAvailable()) {
      localStorage.removeItem(key);
      return;
    }
    if (Platform.OS !== "web") {
      await SecureStore.deleteItemAsync(key);
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
