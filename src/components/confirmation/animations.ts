import { FadeIn, FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";
import { EASE_OUT } from "@/constants/motion";

/**
 * Shared entering presets for the confirmation screens, tuned together so the
 * stamp and points flows feel identical.
 *
 * All timing-based on a single deceleration curve rather than springs: a spring
 * that overshoots reads as a toy, and these screens are worked through dozens of
 * times a day. Motion here is quick and calm, and stops where it lands.
 */

/** The success icon. Scales up and settles, no rebound. */
export const ICON_ENTER = ZoomIn.duration(260).easing(EASE_OUT);

/** Body copy under the icon: a quick fade with a small upward drift. */
export const BODY_ENTER = FadeInDown.duration(260).easing(EASE_OUT);

/** Secondary rows (pills, chips, hints) that follow the body. */
export const DETAIL_ENTER = FadeInDown.delay(120).duration(260).easing(EASE_OUT);

/** Plain fade for inline errors and other in-place appearances. */
export const SOFT_ENTER = FadeIn.duration(180);

/** Bottom-anchored action blocks: rise in last, after the content has landed. */
export const ACTION_ENTER = FadeInUp.delay(200).duration(280).easing(EASE_OUT);
