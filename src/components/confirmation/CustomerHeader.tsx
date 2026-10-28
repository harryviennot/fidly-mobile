import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { SkeletonBox, SkeletonCircle } from "@/components/skeleton/Skeleton";
import { LevelChip } from "@/components/levels/LevelChip";

interface CustomerHeaderProps {
  name: string | null;
  /** Balance line, e.g. "130 pts". Null hides it. */
  balance: string | null;
  /** True while the customer is still loading (keypad-first: header fills in). */
  loading: boolean;
  /** The customer's loyalty level, shown as a chip beside the balance. */
  level?: { name: string } | null;
}

/**
 * Compact customer header: avatar initial + name + balance (and level chip).
 * Renders a skeleton while the customer fetch is in flight so the keypad below
 * is usable immediately.
 */
export function CustomerHeader({ name, balance, loading, level }: CustomerHeaderProps) {
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%" },
        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
        },
        avatarText: { color: theme.primaryText, fontSize: 22, fontWeight: "bold" },
        info: { flex: 1, gap: 4 },
        name: { fontSize: 18, fontWeight: "700", color: theme.text },
        detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        balance: { flexShrink: 1, fontSize: 15, fontWeight: "600", color: theme.textSecondary },
      }),
    [theme]
  );

  if (loading && !name) {
    return (
      <View style={styles.row}>
        <SkeletonCircle size={48} />
        <View style={styles.info}>
          <SkeletonBox width={140} height={18} borderRadius={6} delay={50} />
          <SkeletonBox width={70} height={14} borderRadius={4} delay={100} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(name ?? "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name ?? ""}
        </Text>
        {(balance != null || level) && (
          <View style={styles.detailRow}>
            {level && <LevelChip name={level.name} />}
            {balance != null && (
              <Text style={styles.balance} numberOfLines={1}>
                {balance}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
