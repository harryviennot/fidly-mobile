import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";

interface AmountDisplayProps {
  /** Raw keypad string in the locale separator (e.g. "12,50"). */
  amount: string;
  currencySymbol: string;
  /** Points credited for the typed amount, or null while the rate is unknown. */
  pointsPreview: number | null;
}

/**
 * The big purchase-amount readout + the live "≈ +N pts" conversion preview.
 * The preview row keeps a fixed height so the layout never shifts as it
 * appears/disappears.
 */
export function AmountDisplay({ amount, currencySymbol, pointsPreview }: AmountDisplayProps) {
  const { t } = useTranslation("points");
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: "center", width: "100%" },
        amountRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
        amount: {
          fontSize: 52,
          fontWeight: "700",
          color: amount ? theme.text : theme.textSecondary,
          letterSpacing: 0.5,
        },
        currency: {
          fontSize: 28,
          fontWeight: "600",
          color: theme.textSecondary,
          marginLeft: 6,
          marginBottom: 6,
        },
        previewRow: { height: 24, justifyContent: "center", marginTop: 6 },
        preview: {
          fontSize: 16,
          fontWeight: "600",
          color: theme.primary,
        },
      }),
    [theme, amount]
  );

  const showPreview = pointsPreview != null && pointsPreview > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>{amount || "0"}</Text>
        <Text style={styles.currency}>{currencySymbol}</Text>
      </View>
      <View style={styles.previewRow}>
        {showPreview && (
          <Text style={styles.preview}>{t("amountPreview", { points: pointsPreview })}</Text>
        )}
      </View>
    </View>
  );
}
