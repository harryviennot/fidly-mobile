import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPinIcon } from "phosphor-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { BottomSheet } from "@/components/BottomSheet";
import type { ScannerLocation } from "@/types/api";

interface ProximitySheetProps {
  suggestion: { location: ScannerLocation; distanceMeters: number } | null;
  currentName: string;
  onSwitch: () => void;
  onKeep: () => void;
}

// "120 m" under 1 km, "1.2 km" beyond.
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Bottom sheet suggesting a switch to the location the device is actually near.
 * Driven by the GPS proximity check on lobby load: a non-null `suggestion`
 * presents it. Strictly a suggestion — any dismissal (backdrop tap or "keep")
 * leaves the current selection untouched via `onKeep`.
 */
export function ProximitySheet({
  suggestion,
  currentName,
  onSwitch,
  onKeep,
}: ProximitySheetProps) {
  const { t } = useTranslation("location");
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const loc = suggestion?.location;

  const s = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        content: {
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 16,
        },
        iconWrap: {
          alignSelf: "center",
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.background,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        },
        title: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.text,
          textAlign: "center",
          marginBottom: 8,
        },
        body: {
          fontSize: 15,
          color: theme.textSecondary,
          textAlign: "center",
          lineHeight: 22,
          marginBottom: 24,
        },
        switchButton: {
          backgroundColor: theme.primary,
          paddingVertical: 16,
          borderRadius: 9999,
          alignItems: "center",
        },
        switchText: { color: theme.primaryText, fontSize: 16, fontWeight: "600" },
        keepButton: { paddingVertical: 16, alignItems: "center", marginTop: 4 },
        keepText: { color: theme.textSecondary, fontSize: 15, fontWeight: "500" },
      }),
    [theme, insets.bottom]
  );

  return (
    <BottomSheet
      visible={!!suggestion}
      onClose={onKeep}
      sheetStyle={s.sheet}
      handleColor={theme.border}
      fullSheetDrag
    >
      {loc && (
        <View style={s.content}>
          <View style={s.iconWrap}>
            <MapPinIcon size={28} color={theme.primary} weight="fill" />
          </View>
          <Text style={s.title}>{t("proximity.title")}</Text>
          <Text style={s.body}>
            {t("proximity.body", {
              name: loc.name,
              distance: formatDistance(suggestion!.distanceMeters),
            })}
          </Text>
          <TouchableOpacity style={s.switchButton} onPress={onSwitch} activeOpacity={0.85}>
            <Text style={s.switchText}>{t("proximity.switch", { name: loc.name })}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.keepButton} onPress={onKeep}>
            <Text style={s.keepText}>{t("proximity.keep", { current: currentName })}</Text>
          </TouchableOpacity>
        </View>
      )}
    </BottomSheet>
  );
}
