import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { onboardingStorageKey, type ProgramType } from "./scanner-onboarding";

/** Persistence for the scanner tour. Key logic lives in scanner-onboarding.ts
 *  so it stays unit-testable without React Native. */

export async function hasSeenOnboarding(
  businessId: string,
  programType: ProgramType | null
): Promise<boolean> {
  const key = onboardingStorageKey(businessId, programType);
  try {
    const value =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(key)
        : await AsyncStorage.getItem(key);
    return value === "1";
  } catch {
    // Treat unreadable storage as "already seen": nagging someone with the
    // tour on every launch is worse than them missing it once.
    return true;
  }
}

export async function markOnboardingSeen(
  businessId: string,
  programType: ProgramType | null
): Promise<void> {
  const key = onboardingStorageKey(businessId, programType);
  try {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, "1");
      return;
    }
    await AsyncStorage.setItem(key, "1");
  } catch {
    // Nothing actionable.
  }
}
