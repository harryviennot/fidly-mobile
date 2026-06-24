import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { SkeletonBox, SkeletonCircle } from "@/components/skeleton/Skeleton";

interface CustomerHeaderProps {
  name: string | null;
  /** Balance line, e.g. "130 pts". Null hides it. */
  balance: string | null;
  /** True while the customer is still loading (keypad-first: header fills in). */
  loading: boolean;
}

/**
 * Compact customer header for the points flow: avatar initial + name + balance.
 * Renders a skeleton while the customer fetch is in flight so the keypad below
 * is usable immediately.
 */
export function CustomerHeader({ name, balance, loading }: CustomerHeaderProps) {
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
        balance: { fontSize: 15, fontWeight: "600", color: theme.textSecondary },
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
        {balance != null && <Text style={styles.balance}>{balance}</Text>}
      </View>
    </View>
  );
}
