import { useEffect, useRef, useState } from "react";

/**
 * Tween an integer from `from` to `to` with an ease-out curve. Drives the
 * balance count-up on the points success screen. JS rAF (not a worklet) — it's
 * a single number over <1s, so the cost is negligible and it works identically
 * on native + web. Honors reduced render targets by snapping when delta is 0.
 */
export function useCountUp(
  to: number,
  { from = 0, duration = 700 }: { from?: number; duration?: number } = {}
): number {
  const [value, setValue] = useState(from);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const delta = to - from;
    if (delta === 0) {
      setValue(to);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(from + delta * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [to, from, duration]);

  return value;
}
