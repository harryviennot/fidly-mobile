import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/global.css";
import "@/locales/i18n";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { BusinessProvider } from "@/contexts/business-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { AlertProvider } from "@/contexts/alert-context";

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BusinessProvider>
          <ThemeProvider>
            <AlertProvider>
              <RootNavigator />
            </AlertProvider>
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
