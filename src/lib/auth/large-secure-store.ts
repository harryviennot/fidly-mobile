/**
 * LargeSecureStore - Encrypted storage adapter for Supabase auth tokens
 *
 * Problem: expo-secure-store has a 2048 byte limit per value.
 * Supabase JWT tokens can exceed this limit.
 *
 * Solution: Store encryption key in SecureStore (small, secure)
 * and store encrypted data in AsyncStorage (no size limit).
 * The encryption itself lives in ./encrypted-store.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { createEncryptedStore } from "./encrypted-store";

const nativeStore = createEncryptedStore({
  keys: SecureStore,
  data: AsyncStorage,
  randomBytes: Crypto.getRandomBytes,
});

export class LargeSecureStore {
  /**
   * Get an item from encrypted storage
   */
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS !== "web") return nativeStore.getItem(key);
    // On web, use localStorage directly (no SecureStore available)
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error("LargeSecureStore.getItem error:", error);
      return null;
    }
  }

  /**
   * Set an item in encrypted storage
   */
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS !== "web") return nativeStore.setItem(key, value);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  }

  /**
   * Remove an item from both stores
   */
  async removeItem(key: string): Promise<void> {
    if (Platform.OS !== "web") return nativeStore.removeItem(key);
    try {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error("LargeSecureStore.removeItem error:", error);
    }
  }
}
