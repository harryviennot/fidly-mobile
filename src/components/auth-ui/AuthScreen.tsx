import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeftIcon } from "phosphor-react-native";
import { StampeoLogo } from "@/components/ui/StampeoLogo";
import { colors, spacing, type } from "./tokens";

interface AuthScreenProps {
  /** Headline. Short, sentence case, left aligned. */
  title?: string;
  /** One line under the headline. */
  subtitle?: string;
  /** Back affordance in the top bar. Omit on a root screen. */
  onBack?: () => void;
  backLabel?: string;
  /**
   * Content that belongs with the headline rather than with the actions:
   * fields, a code grid, the shop being joined. Sits directly under the
   * subtitle, so what the employee has to read and what they have to fill in
   * stay together.
   */
  body?: ReactNode;
  /**
   * The action blocks. Anchored to the bottom, where thumbs are. Optional:
   * a screen whose whole content is one self-contained form passes it as
   * `body` and leaves this empty.
   */
  children?: ReactNode;
  /** Quiet links below the actions. */
  footer?: ReactNode;
  /** Inline error, rendered above the actions. */
  error?: string | null;
}

/**
 * The shared frame for every pre-login screen.
 *
 * Full-bleed, not a centered card: the headline sits top-left under the mark
 * and the actions sit at the bottom, so the two things the employee must do
 * (read one line, hit one block) are as far apart as the screen allows and
 * neither lands under a thumb by accident.
 */
export function AuthScreen({
  title,
  subtitle,
  onBack,
  backLabel,
  body,
  children,
  footer,
  error,
}: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={backLabel}
                style={styles.back}
              >
                <ArrowLeftIcon size={22} color={colors.ink} weight="bold" />
              </Pressable>
            ) : (
              <StampeoLogo size={30} color={colors.ink} />
            )}
          </View>

          <View style={styles.head}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {body ? <View style={styles.body}>{body}</View> : null}
          </View>

          {error || children || footer ? (
            <View style={styles.actions}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              {children}
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  topBar: {
    minHeight: 52,
    justifyContent: "center",
  },
  back: {
    width: 40,
    height: 40,
    marginLeft: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  head: {
    paddingTop: spacing.xl,
    gap: spacing.md,
    // Pushes the actions to the bottom of the screen without a fixed height.
    flexGrow: 1,
  },
  title: {
    ...type.display,
    color: colors.ink,
  },
  subtitle: {
    ...type.lead,
    color: colors.inkSoft,
    maxWidth: 420,
  },
  body: {
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  footer: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
    alignItems: "flex-start",
  },
});
