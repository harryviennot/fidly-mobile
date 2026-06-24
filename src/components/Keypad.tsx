import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Backspace } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/theme-context";

interface KeypadProps {
  /** Emits a digit "0"–"9", the decimal separator, or "backspace". */
  onKeyPress: (key: string) => void;
  /** The locale decimal separator shown on the decimal key. */
  separator: string;
  disabled?: boolean;
}

interface KeypadKeyProps {
  label: string;
  onPress: () => void;
  disabled: boolean;
  children: ReactNode;
}

/** A single key with a subtle press-scale + selection haptic. */
function KeypadKey({ label, onPress, disabled, children }: KeypadKeyProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      style={styles.key}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        scale.value = withTiming(0.88, { duration: 70 });
        Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 110 });
      }}
      onPress={onPress}
    >
      <Animated.View style={[styles.keyInner, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Reusable numeric keypad with large fixed touch targets — built for one-handed
 * speed at a busy counter (no OS keyboard latency, guaranteed decimal +
 * backspace, identical on iOS/Android/web). Purely presentational: the parent
 * owns the value and applies presses via utils/money.applyKeypadInput.
 */
export function Keypad({ onKeyPress, separator, disabled = false }: KeypadProps) {
  const { theme } = useTheme();
  const rows = useMemo(
    () => [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      [separator, "0", "backspace"],
    ],
    [separator]
  );

  const keyTextStyle = useMemo(() => ({ fontSize: 28, fontWeight: "600" as const, color: theme.text }), [theme]);

  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key) => (
            <KeypadKey
              key={key}
              label={key === "backspace" ? "Backspace" : key}
              disabled={disabled}
              onPress={() => onKeyPress(key)}
            >
              {key === "backspace" ? (
                <Backspace size={28} color={theme.text} weight="regular" />
              ) : (
                <Text style={keyTextStyle}>{key}</Text>
              )}
            </KeypadKey>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { width: "100%", gap: 4 },
  row: { flexDirection: "row", gap: 4 },
  key: { flex: 1, height: 60, borderRadius: 16 },
  keyInner: { flex: 1, alignItems: "center", justifyContent: "center" },
});
