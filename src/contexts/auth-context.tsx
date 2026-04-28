import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "@/lib/supabase";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { writeLastLogin } from "@/lib/last-login";

export type OAuthProvider = "apple" | "google";

// Native deep-link redirect for OAuth callbacks (must match scheme in app.config.ts).
const NATIVE_OAUTH_REDIRECT = "stampeo-scanner://auth/callback";

// Configure Google Sign In once at module load (native only).
if (Platform.OS !== "web") {
  const iosClientId = Constants.expoConfig?.extra?.googleIosClientId as
    | string
    | undefined;
  const webClientId = Constants.expoConfig?.extra?.googleWebClientId as
    | string
    | undefined;
  if (iosClientId && webClientId) {
    GoogleSignin.configure({ iosClientId, webClientId });
  }
}

// Required for expo-web-browser OAuth completion on web (no-op on native).
WebBrowser.maybeCompleteAuthSession();

// App user profile from public.users table
export interface AppUser {
  id: string; // Equals auth.users.id after migration
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null; // Supabase auth user
  appUser: AppUser | null; // App user profile with real user_id
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signInWithProvider: (
    provider: OAuthProvider
  ) => Promise<{ error: AuthError | { message: string } | null; cancelled?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch app user profile from public.users table
  const fetchAppUser = useCallback(async (authId: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authId)
        .single();

      if (error) {
        console.error("Error fetching app user:", error);
        return null;
      }
      return data as AppUser;
    } catch (err) {
      console.error("Error fetching app user:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    // Get initial session and validate it
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        console.log(`[Auth] initial session: hasSession=${!!session}, expiresAt=${session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : "none"}`);

        // Check if the session token is expired
        if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
          console.log("[Auth] session expired, clearing");
          // Token is expired — clear the stale session
          supabase.auth.signOut({ scope: "local" }).catch(() => {});
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          const profile = await fetchAppUser(session.user.id);
          setAppUser(profile);
        }
      })
      .catch((err) => {
        console.error("[Auth] error getting session:", err);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] event=${event}, hasSession=${!!session}, expiresAt=${session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : "none"}`);

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        const profile = await fetchAppUser(session.user.id);
        setAppUser(profile);
      } else {
        setAppUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAppUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      void writeLastLogin("email", email);
    }
    return { error };
  }, []);

  const signInWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      // Native iOS Apple — uses ASAuthorizationController, returns identity token directly.
      if (provider === "apple" && Platform.OS === "ios") {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (!credential.identityToken) {
            return { error: { message: "Apple sign-in returned no identity token" } };
          }
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "apple",
            token: credential.identityToken,
          });
          if (!error) {
            void writeLastLogin("apple", credential.email ?? undefined);
          }
          return { error };
        } catch (err: unknown) {
          const code = (err as { code?: string }).code;
          if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
            return { error: null, cancelled: true };
          }
          return {
            error: { message: err instanceof Error ? err.message : "Apple sign-in failed" },
          };
        }
      }

      // Native Google (iOS / Android) — uses Google Sign In SDK.
      if (provider === "google" && Platform.OS !== "web") {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const result = await GoogleSignin.signIn();
          const idToken = result.data?.idToken;
          if (!idToken) {
            return { error: { message: "Google sign-in returned no ID token" } };
          }
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });
          if (!error) {
            void writeLastLogin("google", result.data?.user?.email ?? undefined);
          }
          return { error };
        } catch (err: unknown) {
          const code = (err as { code?: string }).code;
          if (code === statusCodes.SIGN_IN_CANCELLED) {
            return { error: null, cancelled: true };
          }
          return {
            error: { message: err instanceof Error ? err.message : "Google sign-in failed" },
          };
        }
      }

      // Fallback: Web (any provider) + native Apple on Android — uses Supabase OAuth via web browser.
      // On web, pin the redirect to /login so the page-level useEffect can run
      // exchangeCodeForSession() deterministically (PKCE flow via @supabase/ssr).
      const redirectTo =
        Platform.OS === "web"
          ? `${globalThis.location.origin}/login`
          : NATIVE_OAUTH_REDIRECT;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
      });

      if (oauthError) return { error: oauthError };

      // On web, supabase-js triggers the redirect itself. Write last-login
      // before navigating away — we won't get another chance to observe success.
      if (Platform.OS === "web") {
        void writeLastLogin(provider);
        return { error: null };
      }

      // On native, open the auth URL in the system browser and wait for the redirect.
      if (!data?.url) {
        return { error: { message: "Failed to start OAuth flow" } };
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        NATIVE_OAUTH_REDIRECT
      );

      if (result.type === "cancel" || result.type === "dismiss") {
        return { error: null, cancelled: true };
      }

      if (result.type !== "success" || !result.url) {
        return { error: { message: "OAuth flow did not complete" } };
      }

      const url = new URL(result.url);
      const code = url.searchParams.get("code");
      if (!code) {
        const errorDescription =
          url.searchParams.get("error_description") || url.searchParams.get("error");
        return {
          error: { message: errorDescription || "OAuth callback missing code" },
        };
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        void writeLastLogin(provider);
      }
      return { error: exchangeError };
    },
    []
  );

  const signOut = useCallback(async () => {
    // Clear React state first so the UI redirects immediately
    setUser(null);
    setAppUser(null);
    setSession(null);
    // Then clean up Supabase storage in the background
    supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, appUser, session, loading, signIn, signInWithProvider, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
