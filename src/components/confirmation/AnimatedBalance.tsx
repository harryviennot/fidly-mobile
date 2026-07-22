import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";
import { useCountUp } from "@/hooks/useCountUp";

interface AnimatedBalanceProps {
  from: number;
  to: number;
  style?: StyleProp<TextStyle>;
}

/**
 * The big points balance that counts up (or down, on redeem) to its new value.
 * A component, not a hook call, so PointsFlow can use it inside conditional
 * success branches without breaking the rules of hooks.
 */
export function AnimatedBalance({ from, to, style }: AnimatedBalanceProps) {
  const value = useCountUp(to, { from });
  return <Text style={style}>{value}</Text>;
}
