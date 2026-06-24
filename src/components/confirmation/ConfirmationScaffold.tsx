import { useMemo, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/theme-context";

/**
 * The themed, centered full-screen container shared by every confirmation
 * state (stamp + points, loading/error/success). Extracted verbatim from the
 * original stamp screen's `container` style so the layout is unchanged.
 */
export function ConfirmationScaffold({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
          padding: 20,
          justifyContent: "center",
          alignItems: "center",
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
        },
      }),
    [theme]
  );

  return <SafeAreaView style={styles.container}>{children}</SafeAreaView>;
}
