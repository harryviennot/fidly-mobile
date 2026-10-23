import { afterEach, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fakeSupabase,
  memoryStorage,
  scannerClient,
  settles,
  TEST_SUPABASE_URL,
  type MemoryStorage,
} from "./fake-supabase";
import { sessionStorageKey, signOutThisDevice } from "./sign-out";

const KEY = sessionStorageKey(TEST_SUPABASE_URL);
const clients: SupabaseClient[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.auth.stopAutoRefresh()));
});

async function signedInPhone(fetch: ReturnType<typeof fakeSupabase>, storage = memoryStorage()) {
  const client = scannerClient(storage, fetch);
  clients.push(client);
  await settles(client.auth.signInWithPassword({ email: "employee@example.com", password: "x" }));
  // The session is where supabase-js keeps it, under the key the wipe targets.
  expect(storage.items.has(KEY)).toBe(true);
  return { client, storage };
}

async function storedSessionAfterRelaunch(storage: MemoryStorage) {
  const relaunched = scannerClient(storage, fakeSupabase());
  clients.push(relaunched);
  const { data } = await settles(relaunched.auth.getSession());
  return data.session;
}

describe("an employee signing out of a shared shop phone", () => {
  it("revokes the session and forgets it on the phone", async () => {
    const { client, storage } = await signedInPhone(fakeSupabase());

    expect(await settles(signOutThisDevice(client, storage, KEY))).toBe(false);

    expect(storage.items.has(KEY)).toBe(false);
    expect(await storedSessionAfterRelaunch(storage)).toBeNull();
  });

  it.each([
    ["offline", () => Promise.reject(new TypeError("Network request failed"))],
    ["the server answers 503", async () => new Response("upstream error", { status: 503 })],
  ])("still forgets the session when the revoke fails: %s", async (_case, logout) => {
    const { client, storage } = await signedInPhone(fakeSupabase({ logout }));

    expect(await settles(signOutThisDevice(client, storage, KEY))).toBe(true);

    // The next person to open the app is not signed in as the one who left.
    expect(await storedSessionAfterRelaunch(storage)).toBeNull();
  });

  it("keeps the session of someone who signed in while the revoke was failing", async () => {
    let failRevoke: (error: Error) => void = () => {};
    const fetch = fakeSupabase({
      logout: () => new Promise<Response>((_, reject) => (failRevoke = reject)),
    });
    const { client, storage } = await signedInPhone(fetch);

    const leaving = signOutThisDevice(client, storage, KEY);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await settles(client.auth.signInWithPassword({ email: "employee@example.com", password: "x" }));
    failRevoke(new TypeError("Network request failed"));

    expect(await settles(leaving)).toBe(false);
    const { data } = await settles(client.auth.getSession());
    expect(data.session?.access_token).toBe("access-2");
  });
});
