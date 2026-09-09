/**
 * Screen transitions shared by the root stack and the pre-login screens.
 *
 * Every screen before the lobby is the same paper surface with a headline in
 * the same place, so a cross-fade is the right move: nothing slides in from a
 * direction that means anything. What was wrong was the length. The native
 * stack's fade runs 350ms by default, which on a chain of short steps (welcome
 * to sign in, sign in to the code field, code to confirmation) reads as the app
 * thinking rather than as one screen becoming the next.
 *
 * 200ms is short enough to feel immediate and still long enough to be a
 * transition. `animationDuration` is honoured by the iOS native stack; Android's
 * fade already runs close to this.
 */
export const AUTH_TRANSITION = {
  animation: "fade",
  animationDuration: 200,
} as const;
