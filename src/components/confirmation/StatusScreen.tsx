import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { ConfirmationScaffold } from "./ConfirmationScaffold";

interface StatusAction {
  label: string;
  onPress: () => void;
}

interface StatusScreenProps {
  /** Icon node rendered inside an 80×80 colored circle. */
  icon: ReactNode;
  /** Circle background color. */
  iconColor: string;
  title: string;
  message: string;
  primary: StatusAction;
  secondary?: StatusAction;
}

/**
 * Shared full-screen status state (paused membership, load/action error). Same
 * icon-circle + title + message + button chrome the original stamp screen used
 * for its paused and error branches, so both flows render these identically.
 */
export function StatusScreen({
  icon,
  iconColor,
  title,
  message,
  primary,
  secondary,
}: StatusScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        iconCircle: {
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: iconColor,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        },
        title: {
          fontSize: 24,
          fontWeight: "bold",
          color: theme.text,
          marginBottom: 8,
          textAlign: "center",
        },
        message: {
          fontSize: 16,
          color: theme.textSecondary,
          textAlign: "center",
          marginBottom: 24,
        },
        button: {
          backgroundColor: theme.primary,
          paddingVertical: 16,
          paddingHorizontal: 32,
          borderRadius: 9999,
        },
        buttonText: {
          color: theme.primaryText,
          fontSize: 16,
          fontWeight: "600",
        },
        secondaryButton: {
          marginTop: 16,
          padding: 12,
        },
        secondaryText: {
          color: theme.textSecondary,
          fontSize: 16,
        },
      }),
    [theme, iconColor]
  );

  return (
    <ConfirmationScaffold>
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={primary.onPress}>
        <Text style={styles.buttonText}>{primary.label}</Text>
      </TouchableOpacity>
      {secondary && (
        <TouchableOpacity style={styles.secondaryButton} onPress={secondary.onPress}>
          <Text style={styles.secondaryText}>{secondary.label}</Text>
        </TouchableOpacity>
      )}
    </ConfirmationScaffold>
  );
}
