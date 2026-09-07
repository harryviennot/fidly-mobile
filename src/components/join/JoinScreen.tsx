import { useRouter } from "expo-router";
import { JoinCodeFlow } from "./JoinCodeFlow";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness } from "@/contexts/business-context";

/**
 * Shared body for both join routes: /join (typed by hand) and /join/[code]
 * (opened from the emailed link). Only the source of the code differs.
 *
 * Deliberately outside both the (auth) and (protected) groups, because it
 * straddles them: reached signed out, signed in with no membership yet (the old
 * no-account dead end), and signed in when adding a second shop.
 */
export function JoinScreen({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { memberships } = useBusiness();

  const canGoBack = user ? memberships.length > 0 : true;

  return (
    <JoinCodeFlow
      initialCode={initialCode}
      // Straight into the tour: a brand-new employee has never seen the lobby,
      // and the tour ends on it anyway.
      onJoined={() => router.replace("/onboarding")}
      onCancel={
        canGoBack
          ? () => router.replace(user ? "/businesses" : "/(auth)/login")
          : undefined
      }
    />
  );
}
