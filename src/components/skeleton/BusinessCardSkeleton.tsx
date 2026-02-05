import { View, StyleSheet } from "react-native";
import { SkeletonBox } from "./Skeleton";

interface BusinessCardSkeletonProps {
  delay?: number;
}

export function BusinessCardSkeleton({ delay = 0 }: BusinessCardSkeletonProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <SkeletonBox width={48} height={48} borderRadius={8} delay={delay} />
        <View style={styles.cardInfo}>
          <SkeletonBox width={140} height={17} borderRadius={4} delay={delay + 50} />
          <SkeletonBox width={60} height={20} borderRadius={4} delay={delay + 100} />
        </View>
        <SkeletonBox width={24} height={24} borderRadius={4} delay={delay + 150} />
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
    gap: 4,
  },
});
