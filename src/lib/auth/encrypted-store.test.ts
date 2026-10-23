import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import * as aesjs from "aes-js";

import { createEncryptedStore } from "./encrypted-store";

const SESSION_KEY = "sb-project-auth-token";
const firstSession = JSON.stringify({ access_token: "access-1", refresh_token: "refresh-1" });
const refreshedSession = JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2" });

/** SecureStore + AsyncStorage stand-ins; `failDataWrites` makes AsyncStorage throw. */
function phoneStorage() {
  const keyItems = new Map<string, string>();
  const dataItems = new Map<string, string>();
  const faults = { failDataWrites: false, keyWrites: 0 };
  const store = createEncryptedStore({
    keys: {
      getItemAsync: async (k) => keyItems.get(k) ?? null,
      setItemAsync: async (k, v) => {
        faults.keyWrites += 1;
        keyItems.set(k, v);
      },
      deleteItemAsync: async (k) => {
        keyItems.delete(k);
      },
    },
    data: {
      getItem: async (k) => dataItems.get(k) ?? null,
      setItem: async (k, v) => {
        if (faults.failDataWrites) throw new Error("disk full");
        dataItems.set(k, v);
      },
      removeItem: async (k) => {
        dataItems.delete(k);
      },
    },
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
  });
  return { store, keyItems, dataItems, faults };
}

describe("the scanner's encrypted session storage", () => {
  it("reads back the latest session after a refresh rewrites it", async () => {
    const { store } = phoneStorage();
    await store.setItem(SESSION_KEY, firstSession);
    await store.setItem(SESSION_KEY, refreshedSession);
    expect(await store.getItem(SESSION_KEY)).toBe(refreshedSession);
  });

  it("rewrites a session with a single data write, never touching the key", async () => {
    // One write is what makes a refresh safe to interrupt: there is no moment
    // where the key and the data disagree.
    const { store, faults } = phoneStorage();
    await store.setItem(SESSION_KEY, firstSession);
    const keyWritesAtSignIn = faults.keyWrites;

    await store.setItem(SESSION_KEY, refreshedSession);
    await store.setItem(SESSION_KEY, firstSession);

    expect(faults.keyWrites).toBe(keyWritesAtSignIn);
  });

  it("keeps the previous session readable when a refresh's write fails", async () => {
    const { store, faults } = phoneStorage();
    await store.setItem(SESSION_KEY, firstSession);

    faults.failDataWrites = true;
    await expect(store.setItem(SESSION_KEY, refreshedSession)).rejects.toThrow();

    expect(await store.getItem(SESSION_KEY)).toBe(firstSession);
  });

  it("never encrypts two writes with the same key and counter", async () => {
    // Same key, same plaintext: identical ciphertext would mean a reused
    // counter, which leaks the XOR of two sessions.
    const { store, dataItems } = phoneStorage();
    const ciphertext = () => dataItems.get(SESSION_KEY)!.split(":").pop();
    await store.setItem(SESSION_KEY, firstSession);
    const first = ciphertext();
    await store.setItem(SESSION_KEY, firstSession);
    expect(ciphertext()).not.toBe(first);
  });

  it.each([
    ["a cut-off value", (stored: string) => stored.slice(0, 7)],
    ["a value with no ciphertext", () => "v2:00ff"],
  ])("reads %s as no session rather than crashing", async (_case, damage) => {
    const { store, dataItems } = phoneStorage();
    await store.setItem(SESSION_KEY, firstSession);
    dataItems.set(SESSION_KEY, damage(dataItems.get(SESSION_KEY)!));
    expect(await store.getItem(SESSION_KEY)).toBeNull();
  });

  it("still reads a session saved by an installed build", async () => {
    // Installed builds wrote a key to SecureStore and the AES-CTR(counter 1)
    // ciphertext as bare hex to AsyncStorage.
    const { store, keyItems, dataItems } = phoneStorage();
    const key = new Uint8Array(randomBytes(32));
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
    keyItems.set(`secure_key_${SESSION_KEY}`, aesjs.utils.hex.fromBytes(key));
    dataItems.set(
      SESSION_KEY,
      aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(firstSession)))
    );

    expect(await store.getItem(SESSION_KEY)).toBe(firstSession);

    // ...and keeps working once the next refresh rewrites it.
    await store.setItem(SESSION_KEY, refreshedSession);
    expect(await store.getItem(SESSION_KEY)).toBe(refreshedSession);
  });

  it("forgets the session and its key on sign-out", async () => {
    const { store, keyItems, dataItems } = phoneStorage();
    await store.setItem(SESSION_KEY, firstSession);
    await store.removeItem(SESSION_KEY);
    expect(await store.getItem(SESSION_KEY)).toBeNull();
    expect(keyItems.size + dataItems.size).toBe(0);
  });
});
