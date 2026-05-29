import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
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
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
} from "phosphor-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { WebBottomSheet } from "@/components/WebBottomSheet";
import type { ScannerLocation } from "@/types/api";

interface LocationPickerProps {
  locations: ScannerLocation[];
  selectedLocation: ScannerLocation | null;
  onSelect: (locationId: string) => void;
}

// Show a search box once the list gets long enough to be worth filtering.
const SEARCH_THRESHOLD = 8;
const IS_WEB = Platform.OS === "web";

/**
 * Location selector shown in the lobby banner. Tapping the pill opens a bottom
 * sheet listing the locations the user can scan at. Native uses
 * @gorhom/bottom-sheet (dynamic sizing + `keyboardBehavior="fillParent"` so a
 * shrinking search result list never collapses behind the keyboard); web falls
 * back to a Modal-based sheet, since gorhom's gestures are unreliable on web.
 * Used only when there are 2+ choices.
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
  const sheetRef = useRef<BottomSheetModal>(null);
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

  // Native: bridge the declarative `open` flag to gorhom's imperative API.
  useEffect(() => {
    if (IS_WEB) return;
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      close();
    },
    [onSelect, close]
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    []
  );

  const s = useMemo(
    () =>
      StyleSheet.create({
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
        // Web sheet surface (native styling comes from gorhom props).
        webSheet: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: windowHeight * 0.7,
        },
      }),
    [theme, windowHeight]
  );

  const renderItem: ListRenderItem<ScannerLocation> = useCallback(
    ({ item }) => {
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
          {isSelected && <CheckIcon size={20} color={theme.primary} weight="bold" />}
        </TouchableOpacity>
      );
    },
    [s, selectedLocation?.id, theme.primary, handleSelect]
  );

  // Header (title + optional search). The search uses the sheet-aware input on
  // native (gorhom keyboard handling) and a plain TextInput on web.
  const Header = (
    <>
      <Text style={s.title}>{t("pickerTitle")}</Text>
      {showSearch && (
        <View style={s.searchWrap}>
          <MagnifyingGlassIcon size={18} color={theme.textSecondary} />
          {IS_WEB ? (
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
            />
          ) : (
            <BottomSheetTextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
            />
          )}
        </View>
      )}
    </>
  );

  const Empty = <Text style={s.empty}>{t("noMatches")}</Text>;
  const listPadding = { paddingBottom: insets.bottom + 12 };

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

      {IS_WEB ? (
        <WebBottomSheet
          visible={open}
          onClose={close}
          sheetStyle={s.webSheet}
          handleColor={theme.border}
        >
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={{ flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={listPadding}
            ListHeaderComponent={Header}
            ListEmptyComponent={Empty}
            renderItem={renderItem}
          />
        </WebBottomSheet>
      ) : (
        <BottomSheetModal
          ref={sheetRef}
          enableDynamicSizing
          enablePanDownToClose
          keyboardBehavior="fillParent"
          keyboardBlurBehavior="restore"
          onDismiss={close}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: theme.surface }}
          handleIndicatorStyle={{ backgroundColor: theme.border, width: 40 }}
        >
          <BottomSheetFlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={listPadding}
            ListHeaderComponent={Header}
            ListEmptyComponent={Empty}
            renderItem={renderItem}
          />
        </BottomSheetModal>
      )}
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
