/**
 * One counter write at a time on a confirmation screen.
 *
 * Every mutation handler (stamp, redeem, held-reward redeem, points) takes this
 * lock before it sends and gives it back when the request has settled,
 * reconcile included. A second write started while one is in flight would
 * share the screen's phase, and whichever finished first would unlock the
 * exits with the other still sending.
 *
 * Plain mutable state rather than React state: two taps inside one frame both
 * read the same render's state, and both would pass a state check.
 */
export interface WriteLock {
  /** Takes the lock, or returns false when another write already holds it. */
  tryAcquire(): boolean;
  release(): void;
}

export function createWriteLock(): WriteLock {
  let held = false;
  return {
    tryAcquire() {
      if (held) return false;
      held = true;
      return true;
    },
    release() {
      held = false;
    },
  };
}
