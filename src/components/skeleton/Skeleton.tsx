import Animated from "react-native-reanimated";
import type { ViewStyle } from "react-native";

const SKELETON_COLOR = "#e8e6e1";

const pulseAnimation = {
  "0%": { opacity: 0.3 },
  "50%": { opacity: 0.7 },
  "100%": { opacity: 0.3 },
};

interface SkeletonBoxProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
  delay?: number;
}

export function SkeletonBox({
  width,
  height,
  borderRadius = 4,
  style,
  delay = 0,
}: SkeletonBoxProps) {
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: SKELETON_COLOR,
          animationName: pulseAnimation,
          animationDuration: "1200ms",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
          animationDelay: `${delay}ms`,
        },
        style,
      ]}
    />
  );
}

interface SkeletonCircleProps {
  size: number;
  style?: ViewStyle;
  delay?: number;
}

export function SkeletonCircle({ size, style, delay = 0 }: SkeletonCircleProps) {
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SKELETON_COLOR,
          animationName: pulseAnimation,
          animationDuration: "1200ms",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
          animationDelay: `${delay}ms`,
        },
        style,
      ]}
    />
  );
}
