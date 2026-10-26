/**
 * Test double for Supabase's auth API, for driving a real supabase-js client in
 * unit tests. Only the test files import it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { TIMED_OUT, withTimeout } from "@/utils/withTimeout";

export const TEST_SUPABASE_URL = "https://project.supabase.test";

export interface FakeSupabaseOptions {
  /** Lifetime of each issued access token, in seconds. */
  lifetime?: number;
  /** Answers `POST /logout` in place of a 204. */
  logout?: () => Promise<Response>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Issues a fresh token pair on every sign-in and refresh, and refuses a refresh
 * token that was already exchanged, the way GoTrue rotates them.
 */
export function fakeSupabase({ lifetime = 3600, logout }: FakeSupabaseOptions = {}) {
  let issued = 0;
  const exchanged = new Set<string>();

  function issue() {
    issued += 1;
    return json({
      access_token: `access-${issued}`,
      refresh_token: `refresh-${issued}`,
      token_type: "bearer",
      expires_in: lifetime,
      expires_at: Math.floor(Date.now() / 1000) + lifetime,
      user: { id: "employee-1", aud: "authenticated", email: "employee@example.com" },
    });
  }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("grant_type=password")) return issue();
    if (url.includes("grant_type=refresh_token")) {
      const { refresh_token } = JSON.parse(String(init?.body ?? "{}"));
      if (exchanged.has(refresh_token)) {
        return json(
          { code: 400, error_code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" },
          400
        );
      }
      exchanged.add(refresh_token);
      return issue();
    }
    if (url.includes("/auth/v1/logout")) {
      return logout ? logout() : new Response(null, { status: 204 });
    }
    return json({ message: "not found" }, 404);
  };
}

export function memoryStorage() {
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

export type MemoryStorage = ReturnType<typeof memoryStorage>;

/** A supabase-js client configured like the scanner's native one. */
export function scannerClient(
  storage: MemoryStorage,
  fetch: ReturnType<typeof fakeSupabase>
): SupabaseClient {
  return createClient(TEST_SUPABASE_URL, "anon-key", {
    auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    global: { fetch: fetch as typeof globalThis.fetch },
  });
}

/** Fails the test instead of hanging it when the auth client is jammed. */
export async function settles<T>(promise: Promise<T>): Promise<T> {
  const result = await withTimeout(promise, 2000);
  if (result === TIMED_OUT) throw new Error("auth call never settled: the client is deadlocked");
  return result;
}
