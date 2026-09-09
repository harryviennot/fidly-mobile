export type AuthPhase = "choose" | "credentials" | "signup";

const PHASES: readonly AuthPhase[] = ["choose", "credentials", "signup"];

/**
 * Which step the sign-in screen opens on, from the `phase` route parameter.
 *
 * It exists so a caller who already knows what the person needs can skip the
 * chooser. The join flow is the caller that matters: it has just shown the
 * three providers itself, so sending someone who taps "Continue with email"
 * to a screen of the same three buttons made them choose email twice, both
 * times under a heading about signing in. Someone holding a team code is
 * almost always new, so it asks for `signup`.
 *
 * The value comes from a URL, so anything unrecognised falls back to the
 * chooser rather than being trusted.
 */
export function initialAuthPhase(param: string | undefined | null): AuthPhase {
  return PHASES.includes(param as AuthPhase) ? (param as AuthPhase) : "choose";
}

/**
 * Where "back" goes: out of the screen entirely, or to the chooser.
 *
 * A phase the caller seeded must leave, because the chooser is the screen we
 * were routed past — dropping into it would put the duplicate right back in
 * front of the person we just spared it.
 */
export function backFromPhase({
  phase,
  seeded,
}: {
  phase: AuthPhase;
  seeded: boolean;
}): "leave" | "choose" {
  if (phase === "choose") return "leave";
  return seeded ? "leave" : "choose";
}
