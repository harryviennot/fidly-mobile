import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "@/components/auth-ui";
import { JOIN_CODE_LENGTH, sanitizeJoinCodeInput } from "@/lib/join-code";

interface JoinCodeInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

/**
 * Six-cell code entry.
 *
 * A hidden TextInput does the real work and the cells are pure display: that
 * keeps paste, autofill and the OS keyboard working, which a grid of
 * per-cell inputs breaks. Keystrokes go through `sanitizeJoinCodeInput`, so a
 * character that can never appear in a code simply cannot be typed.
 *
 * Not built on Keypad.tsx: that is a fixed 4x3 numeric grid whose only
 * variability is a decimal separator, and a 30-glyph alphabet does not fit it.
 */
export function JoinCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  hasError,
}: JoinCodeInputProps) {
  const { t } = useTranslation("join");
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (raw: string) => {
    const next = sanitizeJoinCodeInput(raw);
    if (next === value) return;

    if (next.length > value.length && Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    onChange(next);

    if (next.length === JOIN_CODE_LENGTH) {
      inputRef.current?.blur();
      onComplete?.(next);
    }
  };

  const cells = Array.from({ length: JOIN_CODE_LENGTH }, (_, i) => value[i] ?? "");
  // The cursor sits on the first empty cell, or the last one when full.
  const cursorIndex = Math.min(value.length, JOIN_CODE_LENGTH - 1);

  return (
    <Pressable
      style={styles.container}
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
    >
      {cells.map((char, index) => {
        const isCursor = focused && !disabled && index === cursorIndex;
        return (
          <View
            key={index}
            style={[
              styles.cell,
              char ? styles.cellFilled : null,
              isCursor ? styles.cellActive : null,
              hasError ? styles.cellError : null,
              disabled ? styles.cellDisabled : null,
            ]}
          >
            <Text style={styles.cellText}>{char}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        maxLength={JOIN_CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        keyboardType={Platform.OS === "ios" ? "ascii-capable" : "visible-password"}
        returnKeyType="done"
        accessibilityLabel={t("codeLabel")}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
    // Capped and centred: six flex cells with no ceiling render as huge
    // rectangles on a tablet or the web build.
    maxWidth: 400,
  },
  cell: {
    flex: 1,
    maxWidth: 60,
    aspectRatio: 0.8,
    borderRadius: radius.block,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: {
    borderColor: colors.ink,
  },
  cellActive: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  cellError: {
    borderColor: colors.danger,
  },
  cellDisabled: {
    opacity: 0.5,
  },
  cellText: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
    // Keeps the caret off-screen on web, where opacity alone still shows it.
    color: "transparent",
  },
});
