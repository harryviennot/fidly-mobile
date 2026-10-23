import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

// Supabase awaits its listeners while it holds the auth lock (token refresh,
// startup), so every listener here stays synchronous: a Supabase call awaited in
// one would wait on that same lock, and the client would never refresh again.

export interface AuthStateSink {
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

/** Mirrors every auth event into React state. */
export function subscribeToAuthState(client: SupabaseClient, sink: AuthStateSink) {
  return client.auth.onAuthStateChange((event, session) => {
    console.log(`[Auth] event=${event}, hasSession=${!!session}, expiresAt=${session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : "none"}`);

    sink.setSession(session);
    sink.setUser(session?.user ?? null);
    sink.setLoading(false);
  });
}

/** The current access token, kept in sync for readers that cannot await (request headers). */
export function trackAccessToken(client: SupabaseClient) {
  let token: string | null = null;
  client.auth.onAuthStateChange((_event, session) => {
    token = session?.access_token ?? null;
  });
  return {
    current: () => token,
    clear: () => {
      token = null;
    },
  };
}
