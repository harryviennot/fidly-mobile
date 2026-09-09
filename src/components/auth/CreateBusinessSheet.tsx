import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StorefrontIcon, TicketIcon } from "phosphor-react-native";
import { BottomSheet } from "@/components/BottomSheet";
import { BlockButton, colors, radius, spacing, type } from "@/components/auth-ui";
import { buildOnboardingUrl } from "@/lib/onboarding-url";

interface CreateBusinessSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Takes the employee to the join-code flow instead of leaving the app. */
  onUseCode: () => void;
}

/**
 * The guard on the one path that leaves the app.
 *
 * Creating a business and joining one look similar from the outside ("I work
 * here, I need to get in"), but they are opposite actions: one starts a paid
 * subscription, the other consumes a seat on someone else's. An employee who
 * picks wrong ends up owning an empty business on the web and still cannot
 * scan. So the business path stops here first and names the cheaper option
 * before handing off to the showcase.
 */
export function CreateBusinessSheet({
  visible,
  onClose,
  onUseCode,
}: CreateBusinessSheetProps) {
  const { t, i18n } = useTranslation("welcome");

  const openOnboarding = () => {
    const url = buildOnboardingUrl(i18n.language);
    if (Platform.OS === "web") {
      globalThis.location.href = url;
    } else {
      Linking.openURL(url).catch(() => {});
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet} fullSheetDrag>
      <View style={styles.body}>
        <Text style={styles.title}>{t("business.title")}</Text>
        <Text style={styles.text}>{t("business.body")}</Text>

        <View style={styles.note}>
          <Text style={styles.noteText}>{t("business.employeeNote")}</Text>
        </View>

        <View style={styles.actions}>
          <BlockButton
            variant="primary"
            title={t("business.codeCta")}
            icon={<TicketIcon size={22} color={colors.onBrand} weight="fill" />}
            onPress={() => {
              onClose();
              onUseCode();
            }}
          />
          <BlockButton
            variant="outline"
            title={t("business.continueCta")}
            icon={<StorefrontIcon size={22} color={colors.ink} weight="regular" />}
            onPress={openOnboarding}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  text: {
    ...type.body,
    color: colors.inkSoft,
  },
  note: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.block,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  noteText: {
    ...type.body,
    color: colors.ink,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
});
