type UserId = string | null | undefined;

/**
 * Follows the signed-in user across renders and says when the stored shop
 * choice belongs to someone who just left: a signed-in employee became nobody,
 * or someone else. An empty user before that only means auth is still restoring
 * the session, and the choice must survive it.
 */
export function createSelectionOwner(initialUserId: UserId) {
  let previousUserId = initialUserId;
  return {
    /** Records the user for this render; true when the stored shop should go. */
    userIs(userId: UserId): boolean {
      const left = !!previousUserId && previousUserId !== userId;
      previousUserId = userId;
      return left;
    },
  };
}
