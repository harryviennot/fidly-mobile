import { afterEach, describe, expect, it } from "bun:test";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { subscribeToAuthState, trackAccessToken } from "./auth-listener";
import {
  fakeSupabase,
  memoryStorage,
  scannerClient,
  settles,
  TEST_SUPABASE_URL,
  type MemoryStorage,
} from "./fake-supabase";
import { sessionStorageKey } from "./sign-out";

const clients: SupabaseClient[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.auth.stopAutoRefresh()));
});

/** A real supabase-js client with both of the app's listeners on it. */
function scannerWithAppListeners(storage: MemoryStorage = memoryStorage()) {
  const client = scannerClient(storage, fakeSupabase());
  clients.push(client);
  const seen: { session: Session | null } = { session: null };
  subscribeToAuthState(client, {
    setSession: (session) => {
      seen.session = session;
    },
    setUser: () => {},
    setLoading: () => {},
  });
  const token = trackAccessToken(client);
  return { client, seen, token };
}

describe("a scanner left open across token refreshes", () => {
  it("keeps refreshing, and the app always holds the newest token", async () => {
    const { client, seen, token } = scannerWithAppListeners();
    await settles(client.auth.signInWithPassword({ email: "employee@example.com", password: "x" }));

    // Each refresh runs inside the client's auth lock and waits for the app's
    // listeners; the second only runs if the first released the lock.
    await settles(client.auth.refreshSession());
    await settles(client.auth.refreshSession());

    const { data } = await settles(client.auth.getSession());
    expect(data.session?.access_token).toBe("access-3");
    expect(seen.session?.access_token).toBe("access-3");
    expect(token.current()).toBe("access-3");
  });

  it("survives a 401 retry and the auto-refresh asking for a new token at once", async () => {
    const { client, token } = scannerWithAppListeners();
    await settles(client.auth.signInWithPassword({ email: "employee@example.com", password: "x" }));

    // The fake refuses a refresh token used twice, as GoTrue does.
    const [first, second] = await settles(
      Promise.all([client.auth.refreshSession(), client.auth.refreshSession()])
    );

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(token.current()).not.toBe("access-1");
  });
});

describe("a scanner reopened after its access token expired", () => {
  it("refreshes the stored session at launch instead of signing out", async () => {
    // What the phone holds after a night closed: an expired access token and a
    // live refresh token, under the key supabase-js reads.
    const storage = memoryStorage();
    storage.items.set(
      sessionStorageKey(TEST_SUPABASE_URL),
      JSON.stringify({
        access_token: "access-from-yesterday",
        refresh_token: "refresh-from-yesterday",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) - 3600,
        user: { id: "employee-1", aud: "authenticated", email: "employee@example.com" },
      })
    );

    const { client, seen, token } = scannerWithAppListeners(storage);

    const { data } = await settles(client.auth.getSession());
    expect(data.session?.access_token).toBe("access-1");
    expect(seen.session?.access_token).toBe("access-1");
    expect(token.current()).toBe("access-1");
    // ...and the client is not left jammed for the rest of the day.
    await settles(client.auth.refreshSession());
  });
});
