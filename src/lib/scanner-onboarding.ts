/**
 * Which slides a new employee sees, and whether they have seen them.
 *
 * Pure module with no React Native imports so it stays unit-testable.
 *
 * The sequence is program-aware on purpose: what an employee does at the
 * counter is genuinely different between the two engines. On a stamp program
 * they tap a stepper; on a points program they type the ticket amount on a
 * keypad. Showing the wrong one is worse than showing nothing.
 */

export type ProgramType = "stamp" | "points";

export type OnboardingSlide =
  | "counterQr"
  | "scanning"
  | "stamp"
  | "points"
  | "locations";

interface SlideContext {
  programType: ProgramType | null;
  /** True only when the employee can actually switch between venues. */
  showLocations: boolean;
}

export function buildOnboardingSlides({
  programType,
  showLocations,
}: SlideContext): OnboardingSlide[] {
  const slides: OnboardingSlide[] = ["counterQr", "scanning"];

  // An unknown program type means the design fetch has not landed yet. Skip
  // the engine slide rather than guess: a barista told to use a keypad that
  // isn't there loses more trust than a shorter tour costs.
  if (programType === "stamp") slides.push("stamp");
  else if (programType === "points") slides.push("points");

  if (showLocations) slides.push("locations");

  return slides;
}

const VERSION = "v1";

/**
 * Scoped to business AND program type: someone working two shops should get
 * each one's tour, and a stamp -> points conversion has to replay the engine
 * slide rather than leave the employee on stale instructions.
 */
export function onboardingStorageKey(
  businessId: string,
  programType: ProgramType | null
): string {
  return `scanner_onboarding_${VERSION}:${businessId}:${programType ?? "unknown"}`;
}

/**
 * Only auto-open the tour when we know which engine to describe. An employee
 * who lands on the lobby before the design has loaded gets it on the next
 * visit instead of a generic version.
 */
export function shouldAutoShowOnboarding(params: {
  seen: boolean;
  programType: ProgramType | null;
  businessId: string | null;
}): boolean {
  const { seen, programType, businessId } = params;
  return !seen && !!businessId && programType !== null;
}
