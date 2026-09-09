interface ProtectedViewer {
  /** There is still a session. False the moment sign-out clears it. */
  signedIn: boolean;
  /**
   * The membership list has actually been fetched for THIS user. An empty list
   * is only meaningful once this is true.
   */
  membershipsResolved: boolean;
  /**
   * The last fetch failed. It still counts as resolved, so this is the only
   * thing separating "we asked and they are on no team" from "we asked and the
   * network said nothing".
   */
  membershipsFailed: boolean;
  /** At the group root, with no screen chosen yet. */
  atGroupRoot: boolean;
  hasCurrentBusiness: boolean;
  membershipCount: number;
}

/**
 * Which screen the protected group should land on, or `null` to leave routing
 * alone.
 *
 * The two guards at the top are the whole point. An empty membership list means
 * two completely different things — "this person is on no team" and "we have
 * not asked yet" — and the context reports zero-and-not-loading both in the gap
 * before the first fetch and while a sign-out tears the session down. Acting on
 * either sent people to the join screen, which sits OUTSIDE this group, so the
 * layout never got another turn to correct itself: a scanner with a perfectly
 * good membership was simply stuck on a code field.
 */
export function protectedLanding({
  signedIn,
  membershipsResolved,
  membershipsFailed,
  atGroupRoot,
  hasCurrentBusiness,
  membershipCount,
}: ProtectedViewer): "/lobby" | "/businesses" | "/join" | null {
  // Signing out: this layout is on its way off screen and has no opinion.
  if (!signedIn) return null;
  // Nothing has been fetched yet, so there is nothing to conclude.
  if (!membershipsResolved) return null;

  // The list is empty because the request failed, which is not the same fact.
  // A failed fetch resolves too (freezing routing behind a network blip would
  // be worse), so without this the next rule tells a scanner of four months
  // that they are on no team and drops them on a code screen whose only exits
  // are creating a business and signing out. The picker is the one screen that
  // renders the error with a retry, so it is where a failure belongs; if a shop
  // is still selected the refresh failed in place and nothing should move at
  // all.
  if (membershipsFailed && membershipCount === 0) {
    return hasCurrentBusiness ? null : "/businesses";
  }

  // Part of no team yet: the code screen is the only useful destination, from
  // ANY screen in this group and not just the root. Every screen in here needs
  // a business to render, so the lobby bounces to the picker and the picker has
  // an empty list — which is how the same person ended up on two different
  // screens depending on whether they had just signed in or just cold-started.
  if (membershipCount === 0) return "/join";

  // Already on a real screen — redirecting would fight the user's navigation.
  if (!atGroupRoot) return null;

  if (hasCurrentBusiness) return "/lobby";
  return "/businesses";
}
