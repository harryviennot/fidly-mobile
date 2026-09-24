import { useEffect } from "react";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { DURATION, EASE_OUT } from "@/constants/motion";

/**
 * How a locked control looks while a scan is in flight.
 *
 * ONE rule and ONE value for every control the confirmation flows disable: the
 * X, Cancel, the rewards chip, the stepper, the keypad and the cap screen's
 * Done. Before this, three of them dimmed and the stepper and keypad changed
 * not at all, so two of the largest surfaces on the screen sat completely inert
 * while looking completely live. `Pressable disabled` also kills the
 * press-scale and the haptic, so there was no feedback of any kind — for up to
 * 16s (an 8s write plus its 8s reconcile) where it used to be about 200ms.
 *
 * 0.5, not 0.35: on `theme.textSecondary` a 0.35 label reads as nearly
 * invisible rather than as disabled. It matches what the app already uses for
 * the same idea (RewardsMenu's locked row at 0.55, HeldRewardsList's disabled
 * row at 0.5).
 *
 * Animated rather than switched, because the common case is a request that
 * answers in about 200ms: a straight swap reads as a flicker, a 160ms ease-out
 * reads as the screen settling.
 */
export const LOCKED_OPACITY = 0.5;

export function useLockedDim(locked: boolean) {
  const opacity = useSharedValue(locked ? LOCKED_OPACITY : 1);

  useEffect(() => {
    opacity.value = withTiming(locked ? LOCKED_OPACITY : 1, {
      duration: DURATION.swap,
      easing: EASE_OUT,
    });
  }, [locked, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
