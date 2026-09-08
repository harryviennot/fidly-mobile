import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness } from "@/contexts/business-context";
import { protectedLanding } from "@/lib/protected-landing";

export default function ProtectedLayout() {
  const router = useRouter();
  const segments: string[] = useSegments();
  const { user } = useAuth();
  const { currentBusiness, memberships, membershipsResolved } = useBusiness();

  // Redirect to the right screen within the protected group. The rules live in
  // protectedLanding — including the two that matter most here: a signed-out
  // viewer gets no redirect, and neither does one whose memberships have not
  // been fetched yet.
  const destination = protectedLanding({
    signedIn: !!user,
    membershipsResolved,
    // segments[0] = "(protected)"; no second segment means the group root.
    atGroupRoot: !segments[1],
    hasCurrentBusiness: !!currentBusiness,
    membershipCount: memberships.length,
  });

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="lobby" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="businesses" options={{ animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen
        name="scan"
        options={{
          animation: "slide_from_bottom",
          gestureDirection: "vertical",
          animationDuration: 350
        }}
      />
      <Stack.Screen
        name="stamp/[id]"
        options={{ animation: "slide_from_right" }}
      />
    </Stack>
  );
}
