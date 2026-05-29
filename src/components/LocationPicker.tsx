import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  XIcon,
} from "phosphor-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import type { ScannerLocation } from "@/types/api";

interface LocationPickerProps {
  locations: ScannerLocation[];
  selectedLocation: ScannerLocation | null;
  onSelect: (locationId: string) => void;
}

// Show a search box once the list gets long enough to be worth filtering.
const SEARCH_THRESHOLD = 8;

/**
 * Location selector shown in the lobby banner. Tapping the pill opens a bottom
 * sheet listing the locations the user can scan at. The sheet scrolls and can
 * be searched, so it scales to dozens of locations. Used only when there are
 * 2+ choices — a single location renders as a static label in the lobby.
 */
export function LocationPicker({
  locations,
  selectedLocation,
  onSelect,
}: LocationPickerProps) {
  const { t } = useTranslation("location");
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const showSearch = locations.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q)
    );
  }, [locations, query]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 12,
          maxHeight: "85%",
        },
        grabber: {
          alignSelf: "center",
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.border,
          marginBottom: 12,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          marginBottom: 12,
        },
        title: { fontSize: 18, fontWeight: "700", color: theme.text },
        close: { padding: 4 },
        searchWrap: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginHorizontal: 20,
          marginBottom: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: theme.background,
        },
        searchInput: { flex: 1, fontSize: 15, color: theme.text, padding: 0 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 20,
        },
        rowSelected: { backgroundColor: theme.background },
        name: { fontSize: 16, color: theme.text, fontWeight: "500" },
        address: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
        empty: {
          textAlign: "center",
          color: theme.textSecondary,
          paddingVertical: 24,
        },
      }),
    [theme, insets.bottom]
  );

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <MapPinIcon size={14} color="rgba(255, 255, 255, 0.9)" weight="fill" />
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedLocation?.name ?? t("pickerLabel")}
        </Text>
        <CaretDownIcon size={14} color="rgba(255, 255, 255, 0.9)" weight="bold" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.grabber} />
            <View style={s.header}>
              <Text style={s.title}>{t("pickerTitle")}</Text>
              <TouchableOpacity style={s.close} onPress={() => setOpen(false)}>
                <XIcon size={22} color={theme.textSecondary} weight="bold" />
              </TouchableOpacity>
            </View>

            {showSearch && (
              <View style={s.searchWrap}>
                <MagnifyingGlassIcon size={18} color={theme.textSecondary} />
                <TextInput
                  style={s.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("searchPlaceholder")}
                  placeholderTextColor={theme.textSecondary}
                  autoCorrect={false}
                />
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
              ListEmptyComponent={<Text style={s.empty}>{t("noMatches")}</Text>}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedLocation?.id;
                return (
                  <TouchableOpacity
                    style={[s.row, isSelected && s.rowSelected]}
                    onPress={() => handleSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{item.name}</Text>
                      {item.address ? (
                        <Text style={s.address}>{item.address}</Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <CheckIcon size={20} color={theme.primary} weight="bold" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 9999,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginTop: 4,
  },
  triggerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
});
