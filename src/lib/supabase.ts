/**
 * Supabase client configuration for React Native / Expo
 *
 * This module initializes the Supabase client with:
 * - LargeSecureStore for encrypted token storage (handles tokens > 2048 bytes)
 * - Auto-refresh token handling
 * - App state awareness (stops refresh when backgrounded)
 */
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { LargeSecureStore } from "./large-secure-store";

// Storage adapter using LargeSecureStore for encrypted storage
// This handles Supabase tokens that exceed SecureStore's 2048 byte limit
const storage = new LargeSecureStore();

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file."
  );
}

// Create Supabase client with mobile-optimized settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not needed for mobile apps
  },
});

// Handle app state changes for token refresh management
// This ensures tokens are refreshed when app comes to foreground
// and stops refresh attempts when backgrounded (saves battery/resources)
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}


// Helper to get auth headers for API requests
export async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      ...(session?.access_token && {
        Authorization: `Bearer ${session.access_token}`,
      }),
    };
  } catch {
    // On timeout or error, return headers without auth
    return { "Content-Type": "application/json" };
  }
}

console.log("Supabase client initialized");
