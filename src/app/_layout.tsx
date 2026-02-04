import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Slot, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/global.css";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { BusinessProvider, useBusiness } from "@/contexts/business-context";

function NavigationGuard() {
  const { user, loading: authLoading } = useAuth();
  const { currentBusiness, memberships, loading: bizLoading } = useBusiness();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    if (navigationState?.key) {
      setIsNavigationReady(true);
    }
  }, [navigationState?.key]);

  useEffect(() => {
    if (!isNavigationReady || authLoading) return;

    const onLoginPage = segments[0] === "login";
    const onRootPage = segments.length === 0 || segments[0] === undefined;

    if (!user) {
      // User is not signed in, redirect to login
      if (!onLoginPage) {
        router.replace("/login");
      }
    } else {
      // User is signed in - redirect away from login/root to the app
      if (onLoginPage || onRootPage) {
        // Wait for business loading
        if (bizLoading) return;

        if (currentBusiness) {
          router.replace("/lobby");
        } else if (memberships.length > 0) {
          // Multiple businesses or single business still loading auto-select
          router.replace("/businesses");
        }
      }
    }
  }, [
    user,
    authLoading,
    bizLoading,
    currentBusiness,
    memberships,
    segments,
    router,
    isNavigationReady,
  ]);

  // Show loading screen while checking auth
  if (authLoading || !isNavigationReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BusinessProvider>
          <NavigationGuard />
        </BusinessProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0efe9",
  },
});
