import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckIcon, TranslateIcon } from "phosphor-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { BottomSheet } from "@/components/BottomSheet";
import { getStoredLanguage, setAppLanguage } from "@/lib/app-language";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/locales/i18n";

/**
 * Each language in its own words. Never translated: someone hunting for their
 * language recognises "Polski", not "Polish".
 */
const LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pl: "Polski",
};

interface LanguagePickerProps {
  /** Icon color. Defaults to the banner's on-primary text color. */
  color?: string;
}

/**
 * App language override, opened from the lobby banner.
 *
 * The app follows the phone's language by default, which is right until the
 * phone belongs to the shop and the staff do not read the owner's language.
 * The first row hands control back to the device; the rest pin a language for
 * this device until it is changed again.
 */
export function LanguagePicker({ color }: LanguagePickerProps) {
  const { t } = useTranslation("common");
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  // null = following the device. Read from storage, so the check mark says
  // "device" rather than pointing at whichever language that resolved to.
  const [pinned, setPinned] = useState<SupportedLocale | null>(null);

  useEffect(() => {
    let active = true;
    getStoredLanguage().then((stored) => {
      if (active) setPinned(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSelect = useCallback(async (locale: SupportedLocale | null) => {
    setPinned(locale);
    setOpen(false);
    await setAppLanguage(locale);
  }, []);

  const s = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: Math.max(24, insets.bottom + 12),
        },
        title: {
          fontSize: 18,
          fontWeight: "700",
          color: theme.text,
          paddingHorizontal: 20,
          marginBottom: 12,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 20,
        },
        rowSelected: { backgroundColor: theme.background },
        name: { flex: 1, fontSize: 16, color: theme.text, fontWeight: "500" },
      }),
    [theme, insets.bottom]
  );

  const renderRow = (locale: SupportedLocale | null, label: string) => {
    const isSelected = pinned === locale;
    return (
      <TouchableOpacity
        key={locale ?? "device"}
        style={[s.row, isSelected && s.rowSelected]}
        onPress={() => handleSelect(locale)}
        activeOpacity={0.7}
      >
        <Text style={s.name}>{label}</Text>
        {isSelected && <CheckIcon size={20} color={theme.primaryOnSurface} weight="bold" />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        hitSlop={12}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t("language.title")}
      >
        <TranslateIcon size={20} color={color ?? theme.primaryText} />
      </TouchableOpacity>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        sheetStyle={s.sheet}
        handleColor={theme.border}
        fullSheetDrag
      >
        <Text style={s.title}>{t("language.title")}</Text>
        {renderRow(null, t("language.device"))}
        {SUPPORTED_LOCALES.map((locale) => renderRow(locale, LANGUAGE_NAMES[locale]))}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
