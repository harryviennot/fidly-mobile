import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Minus, Plus } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/theme-context";
import { DURATION, EASE_OUT, SETTLE_SPRING } from "@/constants/motion";

interface StampStepperProps {
  value: number;
  /** Highest quantity the card can absorb (see utils/stamps.maxStampQuantity). */
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

// Hold-to-repeat: a beat before the ramp starts, so a normal tap is always
// exactly one step, then fast steps for setting 8 stamps without eight presses.
const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 90;

/**
 * The `[-] N [+]` quantity control on the stamp screen.
 *
 * Built for the counter: big targets, an immediate press response, and a number
 * that moves in the direction you pushed it, so a busy employee can set "5" in
 * one gesture and trust what they see. Reuses the Keypad key feel (press-scale
 * + highlight + impact haptic) so both scan screens respond identically.
 */
export function StampStepper({ value, max, onChange, disabled = false }: StampStepperProps) {
  const { theme } = useTheme();
  // Drives the digit's enter/exit so +1 rises and -1 falls. React state, not a
  // shared value: it selects which JSX animation the remounted digit uses.
  const [direction, setDirection] = useState(1);

  const step = useCallback(
    (delta: number) => {
      const next = value + delta;
      if (next < 1 || next > max) return false;
      setDirection(delta);
      onChange(next);
      // A weightier tick when the step lands on either end, so the limit is felt
      // on arrival rather than discovered by pressing a dead button.
      Haptics.impactAsync(
        next === max || next === 1
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
      return true;
    },
    [value, max, onChange]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        // Fixed-size well so swapping the digit never nudges the buttons sideways.
        valueWell: { flex: 1, height: 64, alignItems: "center", justifyContent: "center" },
        value: { fontSize: 44, fontWeight: "700", color: theme.text, lineHeight: 50 },
        valueLayer: { position: "absolute", alignItems: "center", justifyContent: "center" },
      }),
    [theme]
  );

  return (
    <View style={styles.row}>
      <StepButton
        label="Remove one stamp"
        atLimit={value <= 1}
        disabled={disabled}
        nudgeTo={-5}
        onStep={() => step(-1)}
      >
        <Minus size={28} color={theme.text} weight="bold" />
      </StepButton>

      <View style={styles.valueWell}>
        {/* Keyed on the value so every change mounts a fresh digit: the old one
            leaves the way it came in, the new one arrives from the side it was
            pushed from. */}
        <Animated.View
          key={value}
          entering={(direction > 0 ? FadeInDown : FadeInUp)
            .duration(DURATION.swap)
            .easing(EASE_OUT)}
          exiting={(direction > 0 ? FadeOutUp : FadeOutDown).duration(130)}
          style={styles.valueLayer}
        >
          <Text style={styles.value} accessibilityLabel={`${value}`}>
            {value}
          </Text>
        </Animated.View>
      </View>

      <StepButton
        label="Add one stamp"
        atLimit={value >= max}
        disabled={disabled}
        nudgeTo={5}
        onStep={() => step(1)}
      >
        <Plus size={28} color={theme.text} weight="bold" />
      </StepButton>
    </View>
  );
}

interface StepButtonProps {
  label: string;
  /** True at the bound: the button stays pressable so it can push back. */
  atLimit: boolean;
  disabled: boolean;
  /** Which way the "no further" nudge travels (outward, away from the number). */
  nudgeTo: number;
  /** Applies one step; returns false when the bound rejected it. */
  onStep: () => boolean;
  children: ReactNode;
}

/**
 * One stepper button. At the limit it is deliberately NOT disabled: a dead
 * button leaves you unsure the press registered, so it nudges outward and ticks
 * instead, which reads as "that's all this card can take".
 */
function StepButton({ label, atLimit, disabled, nudgeTo, onStep, children }: StepButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const nudge = useSharedValue(0);
  const highlight = useSharedValue(0);
  const dim = useSharedValue(atLimit ? 0.35 : 1);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // The repeat interval outlives the render that started it, so it must reach
  // the CURRENT onStep — a captured one would keep re-applying a stale value
  // and the counter would stick one step past where it began.
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stopRepeat = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  }, []);

  // A press that ends off-screen (navigating away mid-hold) would otherwise
  // leave the interval running.
  useEffect(() => stopRepeat, [stopRepeat]);

  useEffect(() => {
    dim.value = withTiming(atLimit ? 0.35 : 1, { duration: 140 });
  }, [atLimit, dim]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: nudge.value }],
  }));
  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlight.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: { width: 76, height: 64, borderRadius: 20 },
        inner: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
        },
      }),
    [theme]
  );

  function apply() {
    if (onStepRef.current()) return;
    // Soft wall: a short outward push that eases straight back, plus a dry tick.
    // Deliberately not a loose spring — this should read as resistance, not as
    // the button wobbling.
    nudge.value = withSequence(
      withTiming(nudgeTo, { duration: 55 }),
      withTiming(0, { duration: 130, easing: EASE_OUT })
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    stopRepeat();
  }

  return (
    <Pressable
      style={styles.button}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        scale.value = withTiming(0.9, { duration: DURATION.instant });
        highlight.value = withTiming(1, { duration: 40 });
        apply();
        holdTimer.current = setTimeout(() => {
          repeatTimer.current = setInterval(apply, HOLD_INTERVAL_MS);
        }, HOLD_DELAY_MS);
      }}
      onPressOut={() => {
        stopRepeat();
        scale.value = withSpring(1, SETTLE_SPRING);
        highlight.value = withTiming(0, { duration: 220 });
      }}
    >
      <Animated.View style={[styles.inner, animatedStyle]}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.stampEmpty }, highlightStyle]}
        />
        <Animated.View style={contentStyle}>{children}</Animated.View>
      </Animated.View>
    </Pressable>
  );
}
