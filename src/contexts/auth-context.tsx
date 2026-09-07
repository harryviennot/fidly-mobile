import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Platform, Linking } from "react-native";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import type {
  GoogleSignin as GoogleSigninType,
  statusCodes as statusCodesType,
} from "@react-native-google-signin/google-signin";
import * as Sentry from "@sentry/react-native";
import { supabase } from "@/lib/supabase";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { writeLastLogin } from "@/lib/last-login";
import { loadOptionalModule } from "@/lib/optional-native";

export type OAuthProvider = "apple" | "google";

/**
 * Send a provider failure to Sentry, tagged so the two STA-246 causes are
 * distinguishable in the dashboard: an iOS "Unacceptable audience in id_token"
 * (Supabase missing the iOS client ID) and an Android code "10"
 * (no Android OAuth client registered in Google Cloud).
 *
 * Both are invisible from the UI, which only ever showed "Sign-in failed".
 * Never let telemetry break a sign-in.
 */
function reportAuthFailure(
  provider: OAuthProvider,
  error: unknown,
  code?: string | number | null
): void {
  try {
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
      {
        tags: {
          auth_provider: provider,
          auth_platform: Platform.OS,
          auth_error_code: String(code ?? "none"),
        },
      }
    );
  } catch {
    // Sentry may be uninitialised (no DSN in dev). Not worth a crash.
  }
}

// Native deep-link redirect for OAuth callbacks (must match scheme in app.config.ts).
const NATIVE_OAUTH_REDIRECT = "stampeo-scanner://auth/callback";

/**
 * Google Sign-In is loaded optionally.
 *
 * A static import binds the whole app's fate to this one native module: when it
 * is absent the import throws while auth-context is being evaluated, and every
 * route that reaches this file fails to export a component. That is not
 * hypothetical -- Expo Go ships a fixed set of modules and no third-party ones,
 * so opening the project there used to brick the entire app rather than just
 * greying out one button.
 *
 * Now a missing module simply means Google is not on offer. Email and Apple
 * still work, which since email sign-up exists is a complete way in.
 */
const google = Platform.OS === "web"
  ? { module: null, available: false }
  : loadOptionalModule<{
      GoogleSignin: typeof GoogleSigninType;
      statusCodes: typeof statusCodesType;
    }>(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      () => require("@react-native-google-signin/google-signin"),
      (m) => !!m?.GoogleSignin
    );

/**
 * Whether the Google button should be offered at all on this build.
 *
 * True on web regardless of the native module: the web build never touches it
 * and signs in through the browser OAuth flow instead.
 */
export const isGoogleSignInAvailable =
  Platform.OS === "web" || google.available;

if (google.available && google.module) {
  const iosClientId = Constants.expoConfig?.extra?.googleIosClientId as
    | string
    | undefined;
  const webClientId = Constants.expoConfig?.extra?.googleWebClientId as
    | string
    | undefined;
  if (iosClientId && webClientId) {
    google.module.GoogleSignin.configure({ iosClientId, webClientId });
  } else {
    // Silently skipping configure() means signIn() later dies with an opaque
    // "failed to determine clientID". Make it loud instead: this can only
    // happen if `extra` failed to embed, which is a build problem.
    console.warn(
      "[Auth] Google Sign-In not configured: missing googleIosClientId/googleWebClientId in expoConfig.extra"
    );
    reportAuthFailure("google", new Error("GoogleSignin.configure skipped: expoConfig.extra missing client IDs"));
  }
} else if (Platform.OS !== "web") {
  console.warn(
    "[Auth] Google Sign-In native module not present in this binary (Expo Go, or a build predating the dependency). Hiding the Google option."
  );
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
  /** Create an account. `alreadyRegistered` means the address exists already,
   *  so the caller should offer sign-in rather than a verification code. */
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: AuthError | null; alreadyRegistered?: boolean }>;
  verifySignupOtp: (
    email: string,
    token: string
  ) => Promise<{ error: AuthError | null }>;
  resendSignupOtp: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithProvider: (
    provider: OAuthProvider
  ) => Promise<{
    error: AuthError | { message: string; code?: string } | null;
    cancelled?: boolean;
  }>;
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

  // Native-only: catch OAuth deep links (`stampeo-scanner://auth/callback?code=...`)
  // that arrive when the app is cold-launched or warm-resumed via the redirect.
  // This is independent of expo-router — we parse the URL directly so the code
  // exchange happens even if Custom Tabs killed the original WebBrowser flow.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;

      // Scope this to the OAuth callback. A join deep link is
      // `stampeo-scanner://join?code=ABCD3F` -- it also carries `code`, and
      // feeding a six-character team code to exchangeCodeForSession would burn
      // the PKCE verifier and fail. Match the path before reading anything.
      if (!url.includes("auth/callback")) return;

      let code: string | null = null;
      try {
        const parsed = new URL(url);
        code = parsed.searchParams.get("code");
      } catch {
        // Some URL inputs trip the WHATWG URL parser; fall back to a quick regex.
        const match = url.match(/[?&]code=([^&]+)/);
        code = match ? decodeURIComponent(match[1]) : null;
      }

      if (!code) return;

      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing) return;

      await supabase.auth.exchangeCodeForSession(code);
    };

    Linking.getInitialURL().then((url) => handleUrl(url)).catch(() => {});

    const sub = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => sub.remove();
  }, []);

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

  // Email sign-up. The Supabase project has email confirmation ON, so this is
  // a two-step flow exactly like the dashboard's: create the account, then
  // verify a six-digit code. Anything that skips the code leaves the employee
  // with an account they cannot use.
  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (error) return { error };

      // Supabase does not error on a duplicate address -- it returns a user
      // with an empty identities array, so that an attacker cannot enumerate
      // accounts. Surface it as its own outcome rather than sending the
      // employee to wait for a code that will never arrive.
      const alreadyRegistered =
        !data?.user || (data.user.identities?.length ?? 0) === 0;

      return { error: null, alreadyRegistered };
    },
    []
  );

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    if (!error) {
      void writeLastLogin("email", email);
    }
    return { error };
  }, []);

  const resendSignupOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error };
  }, []);

  const signInWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      // Native iOS Apple — uses ASAuthorizationController, returns identity token directly.
      if (provider === "apple" && Platform.OS === "ios") {
        try {
          console.log("[Auth] Apple: launching native sign-in");
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          console.log("[Auth] Apple: credential received, hasToken=", !!credential.identityToken, "email=", credential.email ?? "<none>");
          if (!credential.identityToken) {
            return { error: { message: "Apple sign-in returned no identity token" } };
          }
          console.log("[Auth] Apple: exchanging with Supabase");
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "apple",
            token: credential.identityToken,
          });
          if (error) {
            console.log("[Auth] Apple: Supabase rejected token, message=", error.message, "status=", error.status);
          } else {
            console.log("[Auth] Apple: Supabase accepted token");
            void writeLastLogin("apple", credential.email ?? undefined);
          }
          return { error };
        } catch (err: unknown) {
          const code = (err as { code?: string }).code;
          if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
            console.log("[Auth] Apple: user cancelled");
            return { error: null, cancelled: true };
          }
          console.log("[Auth] Apple: SDK threw, code=", code, "err=", err);
          return {
            error: { message: err instanceof Error ? err.message : "Apple sign-in failed" },
          };
        }
      }

      // Native Google (iOS / Android) — uses Google Sign In SDK.
      if (provider === "google" && Platform.OS !== "web") {
        if (!google.available || !google.module) {
          // The button should be hidden in this case, so reaching here means a
          // caller went around the check. Fail with the copy that tells the
          // employee to use another method rather than "try again".
          return {
            error: { message: "Google sign-in is unavailable in this build" },
          };
        }
        const { GoogleSignin, statusCodes } = google.module;
        try {
          console.log("[Auth] Google: checking Play Services");
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          console.log("[Auth] Google: launching native sign-in");
          const result = await GoogleSignin.signIn();

          // v13+ does NOT throw on cancel: it resolves to
          // {type:"cancelled", data:null}. Reading `data.idToken` here and
          // reporting "no ID token" is what made every dismissed sheet look
          // like a failed sign-in (STA-246). The statusCodes.SIGN_IN_CANCELLED
          // branch in the catch below is unreachable for signIn() as a result.
          if (result.type === "cancelled") {
            console.log("[Auth] Google: user cancelled");
            return { error: null, cancelled: true };
          }

          const idToken = result.data?.idToken;
          console.log("[Auth] Google: SDK returned, hasIdToken=", !!idToken, "email=", result.data?.user?.email ?? "<none>");
          if (!idToken) {
            return { error: { message: "Google sign-in returned no ID token" } };
          }
          console.log("[Auth] Google: exchanging with Supabase");
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });
          if (error) {
            console.log("[Auth] Google: Supabase rejected token, message=", error.message, "status=", error.status, "name=", error.name);
            // The iOS half of STA-246 lands here: the SDK signs in fine, then
            // Supabase refuses the token because the iOS client ID is not in
            // its Authorized Client IDs list.
            reportAuthFailure("google", error, error.status);
          } else {
            console.log("[Auth] Google: Supabase accepted token");
            void writeLastLogin("google", result.data?.user?.email ?? undefined);
          }
          return { error };
        } catch (err: unknown) {
          const code = (err as { code?: string }).code;
          if (code === statusCodes.SIGN_IN_CANCELLED) {
            console.log("[Auth] Google: user cancelled");
            return { error: null, cancelled: true };
          }
          console.log("[Auth] Google: SDK threw, code=", code, "err=", err);
          reportAuthFailure("google", err, code);
          return {
            error: {
              message: err instanceof Error ? err.message : "Google sign-in failed",
              // v16's statusCodes has no DEVELOPER_ERROR member, so the raw
              // code has to travel with the error for the UI to classify it.
              code,
            },
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

      console.log(`[Auth] OAuth fallback path: provider=${provider}, redirectTo=${redirectTo}`);
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
      });

      if (oauthError) {
        console.log("[Auth] OAuth: signInWithOAuth error,", oauthError.message);
        return { error: oauthError };
      }

      // On web, supabase-js triggers the redirect itself. Write last-login
      // before navigating away — we won't get another chance to observe success.
      if (Platform.OS === "web") {
        void writeLastLogin(provider);
        return { error: null };
      }

      // On native, open the auth URL in the system browser and wait for the redirect.
      if (!data?.url) {
        console.log("[Auth] OAuth: no URL returned from Supabase");
        return { error: { message: "Failed to start OAuth flow" } };
      }

      console.log("[Auth] OAuth: opening WebBrowser with redirect=", NATIVE_OAUTH_REDIRECT);
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        NATIVE_OAUTH_REDIRECT
      );
      console.log("[Auth] OAuth: WebBrowser returned type=", result.type);

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
        console.log("[Auth] OAuth: no code, errorDescription=", errorDescription);
        return {
          error: { message: errorDescription || "OAuth callback missing code" },
        };
      }

      console.log("[Auth] OAuth: exchanging code for session");
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.log("[Auth] OAuth: exchangeCodeForSession error, message=", exchangeError.message, "status=", exchangeError.status);
      } else {
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
      value={{ user, appUser, session, loading, signIn, signUp, verifySignupOtp,
                resendSignupOtp, signInWithProvider, signOut }}
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
