import { describe, expect, it } from "bun:test";
import { createClient, type Session } from "@supabase/supabase-js";

import { TIMED_OUT, withTimeout } from "@/utils/withTimeout";
import { subscribeToAuthState } from "./auth-listener";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fake Supabase: every token call issues a fresh pair, the way GoTrue rotates refresh tokens. */
function fakeSupabase() {
  let issued = 0;
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/auth/v1/token")) {
      issued += 1;
      return json({
        access_token: `access-${issued}`,
        refresh_token: `refresh-${issued}`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "employee-1", aud: "authenticated", email: "employee@example.com" },
      });
    }
    if (url.includes("/auth/v1/logout")) return new Response(null, { status: 204 });
    return json({ message: "not found" }, 404);
  };
}

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: async (key: string) => {
      items.delete(key);
    },
  };
}

/** A real supabase-js client with the app's listener, signed in as an employee. */
async function signedInScanner() {
  const storage = memoryStorage();
  const client = createClient("https://project.supabase.test", "anon-key", {
    auth: { storage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    global: { fetch: fakeSupabase() as typeof fetch },
  });
  const seen: { session: Session | null } = { session: null };
  subscribeToAuthState(client, {
    setSession: (session) => {
      seen.session = session;
    },
    setUser: () => {},
    setLoading: () => {},
  });
  await settles(client.auth.signInWithPassword({ email: "employee@example.com", password: "x" }));
  return { client, storage, seen };
}

/** Fails the test instead of hanging it when the auth client is jammed. */
async function settles<T>(promise: Promise<T>): Promise<T> {
  const result = await withTimeout(promise, 2000);
  if (result === TIMED_OUT) throw new Error("auth call never settled: the client is deadlocked");
  return result;
}

describe("a scanner left open across token refreshes", () => {
  it("keeps refreshing, and the app always holds the newest token", async () => {
    const { client, seen } = await signedInScanner();

    // Each refresh runs inside the client's auth lock and waits for the app's
    // listener; the second only runs if the first released the lock.
    await settles(client.auth.refreshSession());
    await settles(client.auth.refreshSession());

    const { data } = await settles(client.auth.getSession());
    expect(data.session?.access_token).toBe("access-3");
    expect(seen.session?.access_token).toBe("access-3");
  });

  it("still signs out after refreshing, clearing the stored session", async () => {
    const { client, storage, seen } = await signedInScanner();
    await settles(client.auth.refreshSession());

    await settles(client.auth.signOut({ scope: "local" }));

    expect(seen.session).toBeNull();
    expect([...storage.items.keys()].filter((key) => key.includes("auth-token"))).toEqual([]);
  });
});
