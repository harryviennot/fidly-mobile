import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing, type } from "./tokens";

interface AuthTextFieldProps extends TextInputProps {
  /** Uppercase micro-label above the field. */
  label: string;
  /** Field-level error, shown under the input. */
  error?: string | null;
}

/**
 * A field in the counter-ready style: small uppercase label, tall input, square
 * corners. The label sits above rather than floating inside, so it stays
 * readable while typing and never animates under the caret.
 */
export const AuthTextField = forwardRef<TextInput, AuthTextFieldProps>(
  function AuthTextField({ label, error, style, ...props }, ref) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          style={[styles.input, !!error && styles.inputError, style]}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={label}
          {...props}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.inkSoft,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.block,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: 17,
    color: colors.ink,
    minHeight: 56,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
