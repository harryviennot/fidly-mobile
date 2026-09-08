import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

/**
 * Sign out and land on the welcome screen.
 *
 * The navigation is explicit on purpose. Clearing the session flips
 * `Stack.Protected` back to the `(auth)` group, but expo-router restores that
 * group at whichever screen it was last on — which is the sign-in form for
 * anyone who signed in with a password, and a code field for anyone who came
 * through `/join` (that route sits outside both groups, so the flip does not
 * move it at all). Neither is where someone who just signed out should be.
 *
 * Every sign-out in the app goes through this, so the rule holds wherever the
 * button happens to live.
 */
export function useSignOut(): () => void {
  const { signOut } = useAuth();
  const router = useRouter();

  return useCallback(() => {
    // Route on both paths: a failed local sign-out still cleared the session in
    // memory, so leaving the person on a protected screen would be worse.
    void signOut().finally(() => router.replace("/(auth)/welcome"));
  }, [signOut, router]);
}
