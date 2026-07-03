import { FadeIn, FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";

/**
 * Shared entering presets for the confirmation screens, tuned together so the
 * stamp and points flows feel identical. The icon spring is close to critically
 * damped: a small overshoot (~3%) that settles in one pass instead of the
 * multi-bounce a low-damping spring produces.
 */
export const ICON_ENTER = ZoomIn.springify().damping(18).stiffness(220).mass(0.8);

/** Body copy under the icon: a quick fade with a small upward drift. */
export const BODY_ENTER = FadeInDown.duration(280).springify().damping(20).stiffness(200);

/** Secondary rows (pills, chips, hints) that follow the body. */
export const DETAIL_ENTER = FadeInDown.delay(120).duration(260);

/** Plain fade for inline errors and other in-place appearances. */
export const SOFT_ENTER = FadeIn.duration(180);

/** Bottom-anchored action blocks: rise in last, after the content has landed. */
export const ACTION_ENTER = FadeInUp.delay(200).duration(280);
