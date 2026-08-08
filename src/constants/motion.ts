import { Easing } from "react-native-reanimated";

/**
 * The app's motion vocabulary. One place, so every screen decelerates the same
 * way and nothing bounces.
 *
 * The rule: things ease OUT (fast start, soft landing) and stop. No overshoot,
 * no wobble. These screens are used dozens of times a day at a counter — motion
 * should make the app feel responsive and settled, not springy.
 */

/** Standard deceleration curve for anything entering or moving. */
export const EASE_OUT = Easing.out(Easing.cubic);

/** A touch sharper: for small, fast corrections like a press release. */
export const EASE_OUT_QUAD = Easing.out(Easing.quad);

/**
 * Critically damped spring (damping = 2 * sqrt(stiffness * mass)): it returns
 * to rest as fast as possible WITHOUT crossing the target, so a released button
 * settles instead of jiggling. Lower the damping and it starts to bounce.
 */
export const SETTLE_SPRING = { damping: 40, stiffness: 400, mass: 1 } as const;

/** Durations, so timings stay consistent across screens. */
export const DURATION = {
  /** Press-in, highlight: must feel instantaneous. */
  instant: 60,
  /** A value swapping in place (a digit, a button label). */
  swap: 160,
  /** Something arriving on screen. */
  enter: 240,
} as const;
