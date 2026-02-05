import { View, StyleSheet } from "react-native";
import { SkeletonBox, SkeletonCircle } from "./Skeleton";

interface CustomerCardSkeletonProps {
  totalStamps?: number;
  theme?: {
    surface: string;
    text: string;
  };
}

export function CustomerCardSkeleton({
  totalStamps = 10,
  theme,
}: CustomerCardSkeletonProps) {
  return (
    <View style={[styles.card, theme && { backgroundColor: theme.surface }]}>
      <SkeletonCircle size={80} style={{ marginBottom: 16 }} />
      <SkeletonBox width={160} height={24} borderRadius={6} delay={50} />
      <SkeletonBox
        width={200}
        height={14}
        borderRadius={4}
        delay={100}
        style={{ marginTop: 4, marginBottom: 24 }}
      />
      <SkeletonBox width={100} height={12} borderRadius={4} delay={150} />
      <View style={styles.stampsRow}>
        {[...Array(totalStamps)].map((_, i) => (
          <SkeletonCircle key={i} size={24} delay={200 + i * 30} />
        ))}
      </View>
      <SkeletonBox width={60} height={18} borderRadius={4} delay={250} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#faf9f6",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#2d3436",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  stampsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    marginTop: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
});
