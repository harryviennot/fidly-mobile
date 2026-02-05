import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Stack, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/global.css";
import "@/locales/i18n";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { BusinessProvider } from "@/contexts/business-context";
import { ThemeProvider } from "@/contexts/theme-context";

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();
  const navigationState = useRootNavigationState();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    if (navigationState?.key) {
      setIsNavigationReady(true);
    }
  }, [navigationState?.key]);

  if (authLoading || !isNavigationReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const isLoggedIn = !!user;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="(protected)" />
        </Stack.Protected>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="index" options={{ animation: "none" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BusinessProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
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
