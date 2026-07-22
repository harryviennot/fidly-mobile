import type { ReactNode } from "react";
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from "react-native";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  /** Style of the button surface — applied to the pressable itself, so layout
   * behaves exactly like the TouchableOpacity it replaces. */
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. */
  scaleTo?: number;
  /** Impact haptic fired on press-in, or "none". */
  haptic?: "light" | "medium" | "none";
  children: ReactNode;
}

/**
 * Pressable with the standard CTA press feel: a quick scale-down on touch, a
 * soft spring back on release, and an optional impact haptic. Used for the
 * primary actions in the scan flows so every button responds the same way.
 */
export function PressableScale({
  style,
  scaleTo = 0.97,
  haptic = "light",
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e: GestureResponderEvent) => {
        scale.value = withTiming(scaleTo, { duration: 80 });
        if (haptic !== "none") {
          Haptics.impactAsync(
            haptic === "medium"
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light
          ).catch(() => {});
        }
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.value = withSpring(1, { damping: 20, stiffness: 350 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
