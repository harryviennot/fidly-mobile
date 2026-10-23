/**
 * Supabase client configuration for React Native / Expo
 *
 * - Native: createClient from @supabase/supabase-js + LargeSecureStore (encrypted).
 * - Web: createBrowserClient from @supabase/ssr with cookies on the shared
 *   parent domain (EXPO_PUBLIC_COOKIE_DOMAIN). This lets scan.stampeo.app
 *   share its auth session with app.stampeo.app and stampeo.app.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { LargeSecureStore } from "./auth/large-secure-store";
import { trackAccessToken } from "./auth/auth-listener";
import { sessionStorageKey, signOutThisDevice } from "./auth/sign-out";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file."
  );
}

interface CookieOptions {
  maxAge?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
}

interface CookieToSet {
  name: string;
  value: string;
  options: Partial<CookieOptions>;
}

function parseCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  return document.cookie.split(";").map((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

function setCookie(name: string, value: string, options: CookieOptions) {
  if (typeof document === "undefined") return;
  const cookieDomain = process.env.EXPO_PUBLIC_COOKIE_DOMAIN;
  let cookie = `${name}=${value}`;

  // Use !== undefined so Max-Age=0 (chunk-removal writes from @supabase/ssr)
  // is emitted, not skipped.
  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }
  cookie += `; Path=${options.path || "/"}`;

  if (cookieDomain) {
    cookie += `; Domain=${cookieDomain}`;
  }

  if (options.secure || process.env.NODE_ENV === "production") {
    cookie += "; Secure";
  }

  cookie += `; SameSite=${options.sameSite || "Lax"}`;

  document.cookie = cookie;
}

const nativeAuthStorage = new LargeSecureStore();
const nativeSessionKey = sessionStorageKey(supabaseUrl);

export const supabase: SupabaseClient =
  Platform.OS === "web"
    ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return parseCookies();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              setCookie(name, value, options);
            });
          },
        },
      })
    : createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: nativeAuthStorage,
          autoRefreshToken: true,
          persistSession: true,
        },
      });

// AppState foreground/background refresh — native only.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

// Module-level token cache, read synchronously by getAuthHeaders(). Avoids
// blocking on getSession() during Supabase init.
const accessToken = trackAccessToken(supabase);

/** Signs out of this device only; see auth/sign-out for the offline case. */
export async function signOutOfThisDevice(): Promise<void> {
  if (Platform.OS === "web") {
    await supabase.auth.signOut({ scope: "local" });
    return;
  }
  if (await signOutThisDevice(supabase, nativeAuthStorage, nativeSessionKey)) {
    accessToken.clear();
  }
}

// Synchronous helper to get auth headers for API requests.
// Reads from the in-memory token cache — never blocks on storage.
export function getAuthHeaders(): HeadersInit {
  const token = accessToken.current();
  if (!token) {
    console.warn("[Auth] getAuthHeaders: no access token available");
  }

  return {
    "Content-Type": "application/json",
    // Platform the scan came from (ios | android | web — the browser scanner is
    // this same app's web build). The backend records it on each transaction and
    // on the user's platforms_used list for adoption analytics + achievements.
    "X-Client-Platform": Platform.OS,
    // Installed app version, so the backend force-update gate (GET
    // /public/app-gate) can compare it against the per-platform minimum.
    "X-App-Version": Constants.expoConfig?.version ?? "0.0.0",
    ...(token && {
      Authorization: `Bearer ${token}`,
    }),
  };
}
