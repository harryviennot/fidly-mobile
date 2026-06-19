import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

// One-time native review prompt. A single persistent flag covers both cases the
// product wants: brand-new employees get it on their very first scan, and
// employees who were already using the app before this shipped get it on their
// next scan (the flag was never set).
const STORAGE_KEY = "stampeo_review_prompted";

// In-memory intent set when a scan succeeds and consumed when the employee next
// lands on the lobby. We deliberately do NOT prompt during the scan/stamp flow —
// that would interrupt them mid-task. If the app is killed before they return to
// the lobby the intent is lost, but the persistent flag is still unset, so the
// next scan re-arms it. No persistence needed.
let reviewPending = false;

/** Arm the review prompt after a successful scan. Cheap, sync, fire-and-forget. */
export function markScanCompleted(): void {
  reviewPending = true;
}

async function alreadyPrompted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) !== null;
  } catch {
    // If storage is unreadable, err on the side of not nagging.
    return true;
  }
}

async function markPrompted(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // best-effort: never block the flow on storage
  }
}

/**
 * Show the rating prompt if a scan was completed since the last visit — call
 * this when the lobby screen gains focus, so the prompt lands in a calm moment
 * rather than mid-scan.
 *
 * The store review dialog is fully OS-controlled (no app-provided copy) and is
 * throttled by Apple/Google, so it may render nothing. We still record the
 * attempt so we only ever ask once. Web is unsupported and skipped entirely.
 */
export async function maybeRequestReviewOnLobby(): Promise<void> {
  if (!reviewPending) return;
  // Consume the intent regardless of outcome: one scan arms at most one prompt.
  reviewPending = false;

  // Native-only: the store review API has no meaning on web.
  if (Platform.OS === "web") return;

  if (await alreadyPrompted()) return;

  try {
    const available = await StoreReview.hasAction();
    if (!available) return;
    // Mark before requesting: a single attempt is our budget regardless of
    // whether the OS chooses to surface the dialog.
    await markPrompted();
    await StoreReview.requestReview();
  } catch {
    // Swallow — a failed review prompt must never affect anything else.
  }
}
