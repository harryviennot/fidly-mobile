interface JoinViewer {
  signedIn: boolean;
  membershipCount: number;
}

export interface JoinScreenState {
  /** Show the cancel action: there is somewhere to go back to. */
  canCancel: boolean;
  /**
   * Show the way out (create a business, sign out). Only for someone signed in
   * with no membership, who has no cancel and would otherwise be stuck.
   */
  showEscapeHatch: boolean;
}

/**
 * What the join screen offers besides the code field.
 *
 * This is the shape of the original dead end (STA-246): a signed-in employee
 * with no membership had no cancel, no escape and no way back, so an account
 * created without a code to hand ended at a screen they could not leave. The
 * two flags must never both be false.
 */
export function joinScreenState({
  signedIn,
  membershipCount,
}: JoinViewer): JoinScreenState {
  // Signed out: cancel returns to the welcome screen.
  if (!signedIn) return { canCancel: true, showEscapeHatch: false };
  // Signed in with somewhere to go: cancel returns to the business list.
  if (membershipCount > 0) return { canCancel: true, showEscapeHatch: false };
  return { canCancel: false, showEscapeHatch: true };
}
