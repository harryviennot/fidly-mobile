import { View, StyleSheet } from "react-native";
import { SkeletonBox } from "./Skeleton";

interface BusinessCardSkeletonProps {
  delay?: number;
}

export function BusinessCardSkeleton({ delay = 0 }: BusinessCardSkeletonProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <SkeletonBox width={48} height={48} borderRadius={10} delay={delay} />
        <View style={styles.cardInfo}>
          <SkeletonBox width={140} height={17} borderRadius={4} delay={delay + 50} />
          <View style={styles.cardMeta}>
            <SkeletonBox width={52} height={20} borderRadius={6} delay={delay + 100} />
            <SkeletonBox width={40} height={14} borderRadius={4} delay={delay + 120} />
          </View>
        </View>
        <SkeletonBox width={20} height={20} borderRadius={4} delay={delay + 150} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#faf9f6",
    borderRadius: 10,
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 6,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
