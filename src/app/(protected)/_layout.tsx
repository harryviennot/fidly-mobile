import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useBusiness } from "@/contexts/business-context";

export default function ProtectedLayout() {
  const router = useRouter();
  const segments: string[] = useSegments();
  const { currentBusiness, memberships, loading: bizLoading } = useBusiness();

  // Redirect to correct screen within the protected group
  useEffect(() => {
    if (bizLoading) return;

    // Only redirect when landing at the group root (no specific screen yet)
    const protectedSegment = segments[1]; // segments[0] = "(protected)"
    if (!protectedSegment) {
      if (currentBusiness) {
        router.replace("/lobby");
      } else if (memberships.length === 0) {
        // Signed in but part of no team yet: the code screen is the only
        // useful destination. The business picker would just show an empty
        // list (STA-246).
        router.replace("/join");
      } else {
        router.replace("/businesses");
      }
    }
  }, [bizLoading, currentBusiness, memberships, segments, router]);

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
