import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useTranslation } from "react-i18next";
import { EyeIcon, EyeSlashIcon } from "phosphor-react-native";
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
 *
 * Passing `secureTextEntry` also gets an eye button inside the field. Every
 * password here is typed on a phone, often one-handed behind a counter, and the
 * only feedback a masked field gives is that sign-in failed.
 */
export const AuthTextField = forwardRef<TextInput, AuthTextFieldProps>(
  function AuthTextField({ label, error, style, secureTextEntry, ...props }, ref) {
    const { t } = useTranslation("common");
    const [revealed, setRevealed] = useState(false);
    const isPassword = !!secureTextEntry;

    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <View>
          <TextInput
            ref={ref}
            style={[
              styles.input,
              isPassword && styles.inputWithAction,
              !!error && styles.inputError,
              style,
            ]}
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel={label}
            secureTextEntry={isPassword && !revealed}
            {...props}
          />
          {isPassword ? (
            <Pressable
              onPress={() => setRevealed((current) => !current)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t(revealed ? "hidePassword" : "showPassword")}
              style={styles.reveal}
            >
              {revealed ? (
                <EyeSlashIcon size={22} color={colors.inkSoft} />
              ) : (
                <EyeIcon size={22} color={colors.inkSoft} />
              )}
            </Pressable>
          ) : null}
        </View>
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
  // Keeps the caret and a long password clear of the eye button.
  inputWithAction: {
    paddingRight: 56,
  },
  reveal: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
