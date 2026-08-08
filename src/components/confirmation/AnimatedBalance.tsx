import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";
import { useCountUp } from "@/hooks/useCountUp";

interface AnimatedBalanceProps {
  from: number;
  to: number;
  style?: StyleProp<TextStyle>;
}

/**
 * The big headline counter (points balance, stamp count) tweening to its new
 * value — up on a scan, down on a redeem. A component, not a hook call, so the
 * flows can use it inside conditional success branches without breaking the
 * rules of hooks.
 */
export function AnimatedBalance({ from, to, style }: AnimatedBalanceProps) {
  const value = useCountUp(to, { from });
  return <Text style={style}>{value}</Text>;
}
