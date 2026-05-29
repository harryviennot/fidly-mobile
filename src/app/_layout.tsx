import { ActivityIndicator, View, StyleSheet, Platform } from "react-native";
import { Stack, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import * as SentryReact from "@sentry/react";
import { useEffect } from "react";
import "@/global.css";
import "@/locales/i18n";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { BusinessProvider } from "@/contexts/business-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { AlertProvider } from "@/contexts/alert-context";
import { LocationProvider } from "@/contexts/location-context";

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
const appVariant = (Constants.expoConfig?.extra?.appVariant as string) ?? "production";
const release = `${Constants.expoConfig?.name ?? "stampeo-scanner"}@${Constants.expoConfig?.version ?? "0.0.0"}`;
const tracesSampleRate = appVariant === "production" ? 0.1 : 1.0;

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

if (sentryDsn) {
  if (Platform.OS === "web") {
    SentryReact.init({
      dsn: sentryDsn,
      environment: appVariant,
      release,
      tracesSampleRate,
      sendDefaultPii: false,
      integrations: [
        SentryReact.browserTracingIntegration(),
        SentryReact.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      replaysSessionSampleRate: appVariant === "production" ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0,
    });
  } else {
    Sentry.init({
      dsn: sentryDsn,
      environment: appVariant,
      release,
      tracesSampleRate,
      sendDefaultPii: false,
      integrations: [navigationIntegration],
      enableNativeFramesTracking: true,
    });
  }
}

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
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

function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (Platform.OS !== "web" && navigationRef?.current) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <BusinessProvider>
              <ThemeProvider>
                <AlertProvider>
                  <LocationProvider>
                    <RootNavigator />
                  </LocationProvider>
                </AlertProvider>
              </ThemeProvider>
            </BusinessProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Platform.OS === "web"
  ? SentryReact.withErrorBoundary(RootLayout, {})
  : Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0efe9",
  },
});
