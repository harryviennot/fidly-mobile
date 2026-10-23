import * as aesjs from "aes-js";

/** A small secure store for keys (SecureStore) and a large one for data (AsyncStorage). */
export interface KeyStore {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

export interface DataStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface EncryptedStoreDeps {
  keys: KeyStore;
  data: DataStore;
  randomBytes: (count: number) => Uint8Array;
}

const KEY_PREFIX = "secure_key_";
// `v2:<counter hex>:<ciphertext hex>`. A bare hex value is the older format,
// encrypted with counter 1.
const FORMAT_PREFIX = "v2:";

/**
 * AES-256-CTR storage: one key per item in the key store, the ciphertext in the
 * data store.
 *
 * The key is created once and reused, so rewriting an item is a single data
 * write: an interrupted or failed write leaves the previous value readable.
 * Every write draws a fresh random counter, so the key never encrypts twice
 * from the same counter.
 */
export function createEncryptedStore({ keys, data, randomBytes }: EncryptedStoreDeps) {
  const { hex, utf8 } = aesjs.utils;

  async function readKey(key: string): Promise<Uint8Array | null> {
    const stored = await keys.getItemAsync(`${KEY_PREFIX}${key}`);
    return stored ? hex.toBytes(stored) : null;
  }

  async function readOrCreateKey(key: string): Promise<Uint8Array> {
    const existing = await readKey(key);
    if (existing) return existing;
    const created = randomBytes(32);
    await keys.setItemAsync(`${KEY_PREFIX}${key}`, hex.fromBytes(created));
    return created;
  }

  function decrypt(encryptionKey: Uint8Array, stored: string): string {
    let counter: Uint8Array | number = 1;
    let ciphertext = stored;
    if (stored.startsWith(FORMAT_PREFIX)) {
      const [counterHex, body] = stored.slice(FORMAT_PREFIX.length).split(":");
      counter = hex.toBytes(counterHex);
      ciphertext = body;
    }
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(counter));
    return utf8.fromBytes(cipher.decrypt(hex.toBytes(ciphertext)));
  }

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const stored = await data.getItem(key);
        if (!stored) return null;
        const encryptionKey = await readKey(key);
        if (!encryptionKey) return null;
        return decrypt(encryptionKey, stored);
      } catch (error) {
        console.error("LargeSecureStore.getItem error:", error);
        return null;
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      try {
        const encryptionKey = await readOrCreateKey(key);
        const counter = randomBytes(16);
        const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(counter));
        const ciphertext = cipher.encrypt(utf8.toBytes(value));
        await data.setItem(
          key,
          `${FORMAT_PREFIX}${hex.fromBytes(counter)}:${hex.fromBytes(ciphertext)}`
        );
      } catch (error) {
        console.error("LargeSecureStore.setItem error:", error);
        throw error;
      }
    },

    async removeItem(key: string): Promise<void> {
      try {
        await data.removeItem(key);
        await keys.deleteItemAsync(`${KEY_PREFIX}${key}`);
      } catch (error) {
        console.error("LargeSecureStore.removeItem error:", error);
      }
    },
  };
}
