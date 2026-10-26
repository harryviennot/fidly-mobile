import type { SupabaseClient } from "@supabase/supabase-js";

interface SessionStorage {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
}

/** The key supabase-js stores the session under when given no `storageKey`. */
export function sessionStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/**
 * Ends this device's session and revokes it on the server.
 *
 * When the revoke fails (offline, timeout, 5xx), supabase-js keeps the stored
 * session, and the next person on a shared phone would resume it; it is deleted
 * here anyway. Resolves true when that deletion had to happen.
 */
export async function signOutThisDevice(
  client: SupabaseClient,
  storage: SessionStorage,
  storageKey: string
): Promise<boolean> {
  const leaving = await storage.getItem(storageKey);
  const { error } = await client.auth
    .signOut({ scope: "local" })
    .catch((thrown: unknown) => ({ error: thrown }));
  if (!error || !leaving) return false;

  console.warn("[Auth] sign-out could not revoke the session; deleting it on this device", error);
  // Someone who signed in while the revoke was failing keeps their session.
  if ((await storage.getItem(storageKey)) !== leaving) return false;
  await Promise.all(
    [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`].map((key) =>
      storage.removeItem(key)
    )
  );
  return true;
}
