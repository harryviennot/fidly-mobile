/**
 * Whether the stored shop choice belongs to someone who just left: a signed-in
 * employee became nobody, or someone else. An empty user before that only means
 * auth is still restoring the session, and the choice must survive it.
 */
export function shouldForgetSelectedBusiness(
  previousUserId: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return !!previousUserId && previousUserId !== userId;
}
