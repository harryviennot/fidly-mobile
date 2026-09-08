import { useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { JoinCodeFlow } from "./JoinCodeFlow";
import { CreateBusinessSheet } from "@/components/auth/CreateBusinessSheet";
import { BlockButton } from "@/components/auth-ui";
import { joinScreenState } from "@/lib/join-screen-state";
import { useAuth } from "@/contexts/auth-context";
import { useSignOut } from "@/hooks/use-sign-out";
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
  const { t } = useTranslation("welcome");
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuth();
  const signOutToWelcome = useSignOut();
  const { memberships } = useBusiness();
  const [businessSheetOpen, setBusinessSheetOpen] = useState(false);

  // Which way out this screen offers; the two can never both be absent.
  const { canCancel, showEscapeHatch } = joinScreenState({
    signedIn: !!user,
    membershipCount: memberships.length,
  });

  return (
    <>
      <JoinCodeFlow
        initialCode={initialCode}
        // Straight into the tour: a brand-new employee has never seen the lobby,
        // and the tour ends on it anyway.
        onJoined={() => router.replace("/onboarding")}
        onCancel={
          canCancel
            ? () => router.replace(user ? "/businesses" : "/(auth)/welcome")
            : undefined
        }
        footer={
          showEscapeHatch ? (
            <>
              {/* Without these, an employee who signed up but has no code is
                  stuck on this screen with no way forward and no way out. */}
              <BlockButton
                variant="quiet"
                title={t("businessLink")}
                onPress={() => setBusinessSheetOpen(true)}
              />
              <BlockButton
                variant="quiet"
                title={tCommon("signOut")}
                onPress={signOutToWelcome}
              />
            </>
          ) : undefined
        }
      />

      <CreateBusinessSheet
        visible={businessSheetOpen}
        onClose={() => setBusinessSheetOpen(false)}
        // Already on the join screen: closing the sheet is the whole action.
        onUseCode={() => {}}
      />
    </>
  );
}
