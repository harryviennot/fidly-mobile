import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";

// Deep-link absorber for `stampeo-scanner://auth/callback?code=...`.
//
// On Android, Custom Tabs redirects to this URL when an OAuth flow
// completes. Two scenarios:
//   1. App stayed alive — `WebBrowser.openAuthSessionAsync` already handled
//      the code exchange in `signInWithProvider`. By the time this route
//      mounts, `getSession()` returns an active session, so we skip and
//      redirect home.
//   2. App was killed by the OS while the browser was foregrounded (low-RAM
//      emulators, aggressive memory managers). The original
//      `WebBrowser.openAuthSessionAsync` promise is gone with that process.
//      A new process boots, the deep link routes here, and we run the PKCE
//      code exchange ourselves. The verifier persists in `LargeSecureStore`
//      across restarts, so this still works.
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const code = typeof params.code === "string" ? params.code : null;

    if (!code) {
      setDone(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return;
        await supabase.auth.exchangeCodeForSession(code);
      } catch {
        // Swallow — fall through to redirect home; AuthProvider will reflect
        // whichever state the session ended up in.
      } finally {
        if (!cancelled) setDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.code]);

  if (!done) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return <Redirect href="/" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0efe9",
  },
});
