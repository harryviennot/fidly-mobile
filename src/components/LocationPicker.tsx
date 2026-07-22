import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
} from "phosphor-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { BottomSheet } from "@/components/BottomSheet";
import { withOpacity } from "@/utils/colors";
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
 * sheet listing the locations the user can scan at. The sheet is kept tall (so
 * the search box stays above the keyboard), scrolls, and is searchable — it
 * scales to dozens of locations. Used only when there are 2+ choices.
 */
export function LocationPicker({
  locations,
  selectedLocation,
  onSelect,
}: LocationPickerProps) {
  const { t } = useTranslation("location");
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const showSearch = locations.length > SEARCH_THRESHOLD;

  // Track the keyboard so the list can pad its bottom and stay reachable above it.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0)
    );
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q)
    );
  }, [locations, query]);

  function close() {
    Keyboard.dismiss();
    setOpen(false);
    setQuery("");
  }

  function handleSelect(id: string) {
    onSelect(id);
    close();
  }

  const s = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          // Tall fixed height keeps the search box near the top, well above the
          // keyboard, no matter how few results remain.
          height: windowHeight * 0.85,
        },
        title: {
          fontSize: 18,
          fontWeight: "700",
          color: theme.text,
          paddingHorizontal: 20,
          marginBottom: 12,
        },
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
    [theme, windowHeight]
  );

  const renderItem: ListRenderItem<ScannerLocation> = ({ item }) => {
    const isSelected = item.id === selectedLocation?.id;
    return (
      <TouchableOpacity
        style={[s.row, isSelected && s.rowSelected]}
        onPress={() => handleSelect(item.id)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{item.name}</Text>
          {item.address ? <Text style={s.address}>{item.address}</Text> : null}
        </View>
        {isSelected && <CheckIcon size={20} color={theme.primaryOnSurface} weight="bold" />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: withOpacity(theme.primaryText, 0.18) }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <MapPinIcon size={14} color={theme.primaryText} weight="fill" />
        <Text style={[styles.triggerText, { color: theme.primaryText }]} numberOfLines={1}>
          {selectedLocation?.name ?? t("pickerLabel")}
        </Text>
        <CaretDownIcon size={14} color={theme.primaryText} weight="bold" />
      </TouchableOpacity>

      <BottomSheet
        visible={open}
        onClose={close}
        sheetStyle={s.sheet}
        handleColor={theme.border}
      >
        <Text style={s.title}>{t("pickerTitle")}</Text>
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
          style={{ flexShrink: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 12 + keyboardHeight }}
          ListEmptyComponent={<Text style={s.empty}>{t("noMatches")}</Text>}
          renderItem={renderItem}
        />
      </BottomSheet>
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
});
