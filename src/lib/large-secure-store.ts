/**
 * LargeSecureStore - Encrypted storage adapter for Supabase auth tokens
 *
 * Problem: expo-secure-store has a 2048 byte limit per value.
 * Supabase JWT tokens can exceed this limit.
 *
 * Solution: Store encryption key in SecureStore (small, secure)
 * and store encrypted data in AsyncStorage (no size limit).
 *
 * Uses AES-256-CTR encryption for security.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as aesjs from "aes-js";

// Prefix for encryption keys stored in SecureStore
const KEY_PREFIX = "secure_key_";

export class LargeSecureStore {
  /**
   * Encrypt a value and store the encryption key securely
   */
  private async _encrypt(key: string, value: string): Promise<string> {
    // Generate a random 256-bit (32-byte) encryption key using expo-crypto
    const encryptionKey = Crypto.getRandomBytes(32);

    // Create AES-CTR cipher
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1)
    );

    // Encrypt the value
    const valueBytes = aesjs.utils.utf8.toBytes(value);
    const encryptedBytes = cipher.encrypt(valueBytes);

    // Store encryption key in SecureStore (hex string is small enough)
    await SecureStore.setItemAsync(
      `${KEY_PREFIX}${key}`,
      aesjs.utils.hex.fromBytes(encryptionKey)
    );

    // Return encrypted data as hex string for AsyncStorage
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  /**
   * Decrypt a value using the stored encryption key
   */
  private async _decrypt(
    key: string,
    encryptedValue: string
  ): Promise<string | null> {
    // Get encryption key from SecureStore
    const encryptionKeyHex = await SecureStore.getItemAsync(`${KEY_PREFIX}${key}`);
    if (!encryptionKeyHex) {
      return null;
    }

    // Recreate the cipher with the stored key
    const encryptionKey = aesjs.utils.hex.toBytes(encryptionKeyHex);
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1)
    );

    // Decrypt the value
    const encryptedBytes = aesjs.utils.hex.toBytes(encryptedValue);
    const decryptedBytes = cipher.decrypt(encryptedBytes);

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  /**
   * Get an item from encrypted storage
   */
  async getItem(key: string): Promise<string | null> {
    try {
      // On web, use localStorage directly (no SecureStore available)
      if (Platform.OS === "web") {
        if (typeof window === "undefined") return null;
        return window.localStorage.getItem(key);
      }
      const encryptedValue = await AsyncStorage.getItem(key);
      if (!encryptedValue) {
        return null;
      }
      return await this._decrypt(key, encryptedValue);
    } catch (error) {
      console.error("LargeSecureStore.getItem error:", error);
      return null;
    }
  }

  /**
   * Set an item in encrypted storage
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      // On web, use localStorage directly (no SecureStore available)
      if (Platform.OS === "web") {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(key, value);
        return;
      }
      const encryptedValue = await this._encrypt(key, value);
      await AsyncStorage.setItem(key, encryptedValue);
    } catch (error) {
      console.error("LargeSecureStore.setItem error:", error);
      throw error;
    }
  }

  /**
   * Remove an item from both stores
   */
  async removeItem(key: string): Promise<void> {
    try {
      // On web, use localStorage directly
      if (Platform.OS === "web") {
        if (typeof window === "undefined") return;
        window.localStorage.removeItem(key);
        return;
      }
      // Remove encrypted data from AsyncStorage
      await AsyncStorage.removeItem(key);
      // Remove encryption key from SecureStore
      await SecureStore.deleteItemAsync(`${KEY_PREFIX}${key}`);
    } catch (error) {
      console.error("LargeSecureStore.removeItem error:", error);
    }
  }
}
